/**
 * BM25 检索索引（Okapi BM25, k1=1.5, b=0.75）。
 * 语料为文档数组；查询返回按相关性排序的 { docId, score } 列表。
 * 分数会做文档内最大值归一（0~1），便于与其他信号加权融合。
 */

const { tokenize } = require('./tokenize');
const { LEXICON, CANONICAL_LEXICON } = require('./skills');

const K1 = 1.5;
const B = 0.75;

class Bm25Index {
  /**
   * @param {Array<{id: string, text: string}>} docs
   */
  constructor(docs) {
    this.docTokens = new Map(); // id -> tokens
    this.docLen = new Map();
    this.df = new Map(); // token -> 出现该词的文档数
    this.tf = new Map(); // id -> Map<token, tf>
    this.totalLen = 0;

    for (const doc of docs) {
      const tokens = tokenize(doc.text, new Set([...LEXICON, ...CANONICAL_LEXICON]));
      this.docTokens.set(doc.id, tokens);
      this.docLen.set(doc.id, tokens.length);
      this.totalLen += tokens.length;
      const tfs = new Map();
      for (const t of tokens) tfs.set(t, (tfs.get(t) || 0) + 1);
      this.tf.set(doc.id, tfs);
      for (const t of new Set(tokens)) this.df.set(t, (this.df.get(t) || 0) + 1);
    }
    this.N = docs.length;
    this.avgLen = this.N ? this.totalLen / this.N : 0;
  }

  /** 单词的 IDF（ln((N - df + 0.5) / (df + 0.5) + 1)，非负） */
  idf(token) {
    const df = this.df.get(token) || 0;
    return Math.log((this.N - df + 0.5) / (df + 0.5) + 1);
  }

  /**
   * 查询：返回按分数降序的 [{ id, score }]（score 归一到 0~1，无命中文档时为 0）。
   * @param {string} queryText
   */
  search(queryText) {
    if (!this.N || !this.avgLen) return [];
    const qTokens = tokenize(queryText, new Set([...LEXICON, ...CANONICAL_LEXICON]));
    const scores = new Map();
    for (const t of new Set(qTokens)) {
      const idf = this.idf(t);
      if (idf <= 0) continue;
      for (const [id, tfs] of this.tf) {
        const freq = tfs.get(t) || 0;
        if (!freq) continue;
        const dl = this.docLen.get(id);
        const denom = freq + K1 * (1 - B + B * (dl / this.avgLen));
        const s = idf * ((freq * (K1 + 1)) / denom);
        scores.set(id, (scores.get(id) || 0) + s);
      }
    }
    let max = 0;
    for (const s of scores.values()) max = Math.max(max, s);
    const out = [...scores.entries()].map(([id, score]) => ({ id, score: max ? score / max : 0 }));
    out.sort((a, b) => b.score - a.score);
    return out;
  }
}

module.exports = { Bm25Index };
