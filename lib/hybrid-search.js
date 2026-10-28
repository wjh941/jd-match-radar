/**
 * 混合检索：BM25(词级精确) + 字符 N-gram 向量(子词语义) [+ API Embedding(真语义)] + RRF 融合。
 *
 * 通道互补：
 * - BM25 精确命中"React"、"MySQL"等关键词，但对拼写变体和子词关联不敏感
 * - 字符 bigram 向量能捕捉"机器学係"、"ML平台"等模糊语义，但只能做字面匹配
 * - API Embedding(BYOK) 捕捉"负责数据库"↔"数据仓库"的真语义关联——没配 Key 时自动退化为双通道
 * RRF 用排名（而非分数）融合，天然免疫不同检索器的分数量纲差异。
 */

const { Bm25Index } = require('./bm25');
const { CharNGramVectorIndex } = require('./vector-search');
const { rrfFuse } = require('./rrf');
const { ApiEmbedder } = require('./api-embedder');

/**
 * 混合检索索引：构建时同时建立 BM25 和向量两套索引；
 * API Embedding 通道按需预热（attachEmbeddings），不配 Key 完全零开销。
 */
class HybridIndex {
  constructor(docs) {
    this.docs = docs;
    this.bm25 = new Bm25Index(docs);
    this.vector = new CharNGramVectorIndex(docs);
    this.docEmbeddings = null; // id -> Float32Array，attachEmbeddings 后可用
  }

  /**
   * 预热 API Embedding 通道：一次性批量编码全部文档。
   * @param {ApiEmbedder} embedder
   * @returns {Promise<boolean>} 通道是否可用
   */
  async attachEmbeddings(embedder) {
    // 鸭子类型：外部可注入自带 embedBatch 的实现（测试 mock / 自定义 provider）
    const emb = typeof embedder?.embedBatch === 'function'
      ? embedder
      : new ApiEmbedder(embedder || {});
    if (!emb.available) return false;
    const vectors = await emb.embedBatch(this.docs.map((d) => d.text));
    // 任一文档编码失败则整个通道不可用，避免部分通道结果失真
    if (vectors.some((v) => !v)) return false;
    this.docEmbeddings = new Map(this.docs.map((d, i) => [d.id, vectors[i]]));
    this.embedder = emb;
    return true;
  }

  /**
   * 混合检索：BM25 + 向量余弦相似度，RRF 融合排名。
   * @param {string} queryText
   * @param {number} [rrfK=60]
   * @returns {Array<{id: string, score: number, channels: number}>}
   */
  search(queryText, rrfK = 60) {
    const bm25Ranking = this.bm25.search(queryText);
    const vecRanking = this.vector.search(queryText);
    return rrfFuse([bm25Ranking, vecRanking], rrfK);
  }

  /**
   * 深度检索：在双通道之上叠加 API Embedding 语义通道（需先 attachEmbeddings）。
   * 未预热时自动退化为双通道 search()，调用方无需分支。
   * @param {string} queryText
   * @param {number} [rrfK=60]
   */
  async searchDeep(queryText, rrfK = 60) {
    if (!this.docEmbeddings || !this.embedder) return this.search(queryText, rrfK);
    const [queryVec] = await this.embedder.embedBatch([queryText]);
    if (!queryVec) return this.search(queryText, rrfK);
    const semRanking = this.docs
      .map((d) => ({ id: d.id, score: ApiEmbedder.cosine(queryVec, this.docEmbeddings.get(d.id)) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const bm25Ranking = this.bm25.search(queryText);
    const vecRanking = this.vector.search(queryText);
    return rrfFuse([bm25Ranking, vecRanking, semRanking], rrfK);
  }
}

module.exports = { HybridIndex, rrfFuse };
