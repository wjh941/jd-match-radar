/**
 * Reciprocal Rank Fusion (RRF)：
 * 将多个检索通道的排名合并为一个统一排序。
 *
 * 公式：RRF_score(d) = Σ 1 / (k + rank_i(d))
 * 其中 k=60 是平滑常数，rank_i 是文档 d 在第 i 个通道中的排名（从 1 开始）。
 *
 * RRF 的优势：不需要对分数做归一化——只用排名，天然免疫不同检索器的分数量纲差异。
 * 这是生产级混合检索系统的标准融合方法（Elasticsearch、Weaviate 均内置 RRF）。
 */

/**
 * @param {Array<Array<{id: string, score: number}>>} rankings 多个检索通道的排名结果
 * @param {number} [k=60] RRF 平滑常数
 * @returns {Array<{id: string, score: number, channels: number}>}
 */
function rrfFuse(rankings, k = 60) {
  const scores = new Map(); // id -> { score, channels }
  for (const ranking of rankings) {
    ranking.forEach((item, rank) => {
      const id = typeof item === 'string' ? item : item.id;
      const entry = scores.get(id) || { score: 0, channels: 0 };
      entry.score += 1 / (k + rank + 1);
      entry.channels += 1;
      scores.set(id, entry);
    });
  }
  return [...scores.entries()]
    .map(([id, { score, channels }]) => ({ id, score, channels }))
    .sort((a, b) => b.score - a.score);
}

module.exports = { rrfFuse };
