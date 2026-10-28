const test = require('node:test');
const assert = require('node:assert');
const { HybridIndex } = require('../lib/hybrid-search');
const { matchJdDeep, matchJd } = require('../lib/scorer');
const { ApiEmbedder } = require('../lib/api-embedder');
const { RESUMES, JDS } = require('../server/seed');

/** 确定性 mock：把文本哈希成固定维度向量，语义通道按"长度相似度"排序，全程无网络 */
function mockEmbedder(dim = 8) {
  const vec = (t) => {
    const v = new Float32Array(dim);
    for (let i = 0; i < t.length; i++) v[i % dim] += (t.charCodeAt(i) % 97) / 97;
    return v;
  };
  return {
    available: true,
    embedBatch: async (texts) => texts.map(vec),
  };
}

const jd = JDS.find((j) => j.id === 'j02');

test('未配 Key：attachEmbeddings 返回 false，searchDeep 退化为双通道', async () => {
  const idx = new HybridIndex(RESUMES.map((r) => ({ id: r.id, text: r.text })));
  const attached = await idx.attachEmbeddings({});
  assert.strictEqual(attached, false);
  const deep = await idx.searchDeep('Java 后端');
  const plain = idx.search('Java 后端');
  assert.deepStrictEqual(deep, plain);
});

test('配 Key（mock）：预热后 searchDeep 走三通道融合', async () => {
  const idx = new HybridIndex(RESUMES.map((r) => ({ id: r.id, text: r.text })));
  const attached = await idx.attachEmbeddings(mockEmbedder());
  assert.strictEqual(attached, true);
  const deep = await idx.searchDeep('Java 后端');
  const plain = idx.search('Java 后端');
  // 三通道 RRF 分数上限更高（3 个通道各贡献 ≤1），结果应为有效降序排名
  assert.ok(deep.length > 0);
  for (let i = 1; i < deep.length; i++) assert.ok(deep[i - 1].score >= deep[i].score);
  // RRF 取各通道排名并集：双通道命中的文档必出现在深通道结果里
  const deepIds = new Set(deep.map((x) => x.id));
  for (const p of plain) assert.ok(deepIds.has(p.id), `双通道命中 ${p.id} 未出现在深通道`);
});

test('matchJdDeep（mock）：结构与 matchJd 一致且带 deep 标记', async () => {
  const deep = await matchJdDeep(jd, RESUMES, mockEmbedder());
  const plain = matchJd(jd, RESUMES);
  assert.strictEqual(deep.deep, true);
  assert.deepStrictEqual(Object.keys(deep).sort(), Object.keys({ ...plain, deep: true }).sort());
  assert.deepStrictEqual(deep.jd, plain.jd);
  assert.deepStrictEqual(deep.requirements, plain.requirements);
  assert.strictEqual(deep.results.length, plain.results.length);
  for (const r of deep.results) assert.ok(r.score >= 0 && r.score <= 100);
});

test('matchJdDeep：空 opts（无 Key 无环境变量）时 deep=false 且仍出完整结果', async () => {
  const savedKey = process.env.EMBEDDING_API_KEY;
  delete process.env.EMBEDDING_API_KEY;
  try {
    const deep = await matchJdDeep(jd, RESUMES, {});
    assert.strictEqual(deep.deep, false);
    assert.ok(deep.results.length > 0);
  } finally {
    if (savedKey !== undefined) process.env.EMBEDDING_API_KEY = savedKey;
  }
});

test('ApiEmbedder.embedBatch：网络失败时返回 null 向量（不抛错）', async () => {
  const emb = new ApiEmbedder({ apiKey: 'sk-test', baseUrl: 'http://127.0.0.1:1/v1' });
  const out = await emb.embedBatch(['a', 'b']);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0], null);
  assert.strictEqual(out[1], null);
});

test('评分确定性：matchJdDeep 同输入两次结果完全一致', async () => {
  const a = await matchJdDeep(jd, RESUMES, mockEmbedder());
  const b = await matchJdDeep(jd, RESUMES, mockEmbedder());
  assert.deepStrictEqual(a, b);
});
