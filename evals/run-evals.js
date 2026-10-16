/**
 * 确定性评测集：真值标注下的检索质量。
 * 指标：Recall@3（前 3 名覆盖真值的比例）与 MRR（平均倒数排名）。
 * 全程无随机数、无网络调用——CI 里跑出的是与本地完全相同的数字。
 */

const { RESUMES, JDS, GROUND_TRUTH } = require('../server/seed');
const { matchJd } = require('../lib/scorer');

/** 对单个 JD 评测，返回 { jdId, recallAt3, mrr, hits, total } */
function evalJd(jdId) {
  const jd = JDS.find((j) => j.id === jdId);
  const truth = GROUND_TRUTH[jdId] || [];
  const { results } = matchJd(jd, RESUMES);
  const rankedIds = results.map((r) => r.resumeId);

  const hits = truth.filter((t) => rankedIds.slice(0, 3).includes(t)).length;
  const recallAt3 = truth.length ? hits / truth.length : 1;
  let mrr = 0;
  for (const t of truth) {
    const rank = rankedIds.indexOf(t) + 1;
    if (rank > 0) mrr += 1 / rank;
  }
  mrr = truth.length ? mrr / truth.length : 1;
  return { jdId, jdTitle: jd.title, recallAt3, mrr, hits, total: truth.length };
}

/** 全量评测 */
function runEvals() {
  const perJd = Object.keys(GROUND_TRUTH).map(evalJd);
  const macroRecall = perJd.reduce((s, x) => s + x.recallAt3, 0) / perJd.length;
  const macroMrr = perJd.reduce((s, x) => s + x.mrr, 0) / perJd.length;
  return { perJd, macroRecallAt3: macroRecall, macroMrr };
}

module.exports = { evalJd, runEvals };

if (require.main === module) {
  const { macroRecallAt3, macroMrr, perJd } = runEvals();
  console.log('岗位匹配雷达 · 确定性评测（真值标注）');
  console.log('='.repeat(56));
  for (const r of perJd) {
    const flag = r.recallAt3 === 1 ? '✓' : '·';
    console.log(
      `  ${flag} ${r.jdId} ${r.jdTitle.padEnd(18)} Recall@3=${r.recallAt3.toFixed(2)}  MRR=${r.mrr.toFixed(3)}  真值 ${r.hits}/${r.total}`,
    );
  }
  console.log('='.repeat(56));
  console.log(`Macro Recall@3 = ${macroRecallAt3.toFixed(3)}`);
  console.log(`Macro MRR      = ${macroMrr.toFixed(3)}`);
  process.exit(macroRecallAt3 >= 0.9 && macroMrr >= 0.85 ? 0 : 1);
}
