/**
 * 混合检索：BM25(词级精确) + 字符 N-gram 向量(子词语义) + RRF 融合。
 *
 * 两通道互补：
 * - BM25 精确命中"React"、"MySQL"等关键词，但对拼写变体和子词关联不敏感
 * - 字符 bigram 向量能捕捉"机器学係"、"ML平台"等模糊语义，但精确度较低
 * RRF 用排名（而非分数）融合，天然免疫不同检索器的分数量纲差异。
 */

const { Bm25Index } = require('./bm25');
const { CharNGramVectorIndex } = require('./vector-search');
const { rrfFuse } = require('./rrf');

/**
 * 混合检索索引：构建时同时建立 BM25 和向量两套索引。
 */
class HybridIndex {
  constructor(docs) {
    this.docs = docs;
    this.bm25 = new Bm25Index(docs);
    this.vector = new CharNGramVectorIndex(docs);
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
}

module.exports = { HybridIndex, rrfFuse };
