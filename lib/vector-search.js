/**
 * 字符 N-gram 向量检索（TF-IDF 加权 + 余弦相似度）。
 *
 * 与 BM25 的区别：BM25 是词级别的精确匹配（"机器学习"要么命中要么不命中），
 * 字符 bigram 向量把"机器学习"拆成"机器/器学/学习"三个向量维度，
 * 能捕捉"机器学係"、"ML平台"等拼写变体和子词级的语义关联。
 *
 * 两者通过 RRF 融合后作为混合检索的最终排序——这是经典的信息检索混合模式
 * （lexical + vector），也是生产级 RAG 系统的标准做法。
 */

/** 中文和拉丁字符的 N-gram 切分 */
function charNGrams(text, n = 2) {
  const tokens = [];
  const cjkRuns = String(text || '').match(/[\u4e00-\u9fff]+/g) || [];
  for (const run of cjkRuns) {
    if (run.length < n) { tokens.push(run); continue; }
    for (let i = 0; i <= run.length - n; i++) tokens.push(run.slice(i, i + n));
  }
  // 拉丁词也作为维度
  for (const m of String(text || '').matchAll(/[a-zA-Z0-9][a-zA-Z0-9+.#\-]*/g)) {
    const w = m[0].toLowerCase();
    if (w.length >= 2) tokens.push(w);
  }
  return tokens;
}

class CharNGramVectorIndex {
  /**
   * @param {Array<{id: string, text: string}>} docs
   * @param {number} [ngramSize=2]
   */
  constructor(docs, ngramSize = 2) {
    this.n = ngramSize;
    this.N = docs.length;
    this.docVectors = new Map(); // id -> Map<ngram, tfidf_weight>
    this.idf = new Map(); // ngram -> IDF
    this.docNorms = new Map(); // id -> 向量 L2 范数

    // Pass 1: 统计 DF（文档频率）
    const ngramDocs = new Map(); // ngram -> 出现的文档数
    const docNgramTf = new Map(); // id -> Map<ngram, tf>
    for (const doc of docs) {
      const ngrams = charNGrams(doc.text, this.n);
      const tfs = new Map();
      for (const g of ngrams) tfs.set(g, (tfs.get(g) || 0) + 1);
      docNgramTf.set(doc.id, tfs);
      for (const g of new Set(ngrams)) {
        ngramDocs.set(g, (ngramDocs.get(g) || 0) + 1);
      }
    }

    // Pass 2: 计算 TF-IDF 权重和 L2 范数
    for (const [id, tfs] of docNgramTf) {
      const vec = new Map();
      let normSq = 0;
      for (const [g, tf] of tfs) {
        const df = ngramDocs.get(g) || 1;
        const idf = Math.log((this.N + 1) / (df + 1)) + 1; // 平滑 IDF，非负
        const w = tf * idf;
        vec.set(g, w);
        normSq += w * w;
      }
      this.docVectors.set(id, vec);
      this.docNorms.set(id, Math.sqrt(normSq));
    }
  }

  /**
   * 余弦相似度检索：返回按相似度降序的 [{ id, score }]（0~1）。
   * @param {string} queryText
   */
  search(queryText) {
    if (!this.N) return [];
    const qNgrams = charNGrams(queryText, this.n);
    if (!qNgrams.length) return [];

    // 构建查询向量
    const qTf = new Map();
    for (const g of qNgrams) qTf.set(g, (qTf.get(g) || 0) + 1);
    const qVec = new Map();
    let qNormSq = 0;
    for (const [g, tf] of qTf) {
      const df = 1; // 查询词视为稀有的
      const idf = Math.log((this.N + 1) / (df + 1)) + 1;
      const w = tf * idf;
      qVec.set(g, w);
      qNormSq += w * w;
    }
    const qNorm = Math.sqrt(qNormSq);
    if (!qNorm) return [];

    // 余弦相似度
    const scores = [];
    for (const [id, dVec] of this.docVectors) {
      let dot = 0;
      for (const [g, qw] of qVec) {
        const dw = dVec.get(g);
        if (dw) dot += qw * dw;
      }
      const dNorm = this.docNorms.get(id) || 1;
      const sim = dot / (qNorm * dNorm);
      if (sim > 0) scores.push({ id, score: sim });
    }
    scores.sort((a, b) => b.score - a.score);
    // 归一到 0~1
    const max = scores[0]?.score || 1;
    return scores.map(s => ({ id: s.id, score: s.score / max }));
  }
}

module.exports = { CharNGramVectorIndex, charNGrams };
