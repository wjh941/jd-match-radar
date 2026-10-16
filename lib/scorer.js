/**
 * 可解释匹配评分器。
 *
 * 总分 = 0.55 × 技能分 + 0.35 × 文本分 + 0.10 × 结构分，输出 0~100。
 * - 技能分：JD 抽取出的核心技能（权重 3）与加分技能（权重 1）在简历中的覆盖率
 * - 文本分：JD 全文对简历全文的 BM25 归一相关度
 * - 结构分：学历/年限等结构化条件的满足度
 * 每一维都输出依据（命中证据/缺口清单），评分永远可解释——这是与"黑盒打分"的区别。
 */

const { extractSkills, skillsInCategory } = require('./skills');
const { Bm25Index } = require('./bm25');

/** 从 JD 文本抽取技能需求：技术类别词表内的为核心(权重3)，其余命中为加分(权重1) */
function extractJdRequirements(jdText) {
  const { found } = extractSkills(jdText);
  const core = [];
  const plus = [];
  for (const [canonical, meta] of found) {
    // 技术三大类（前端/后端/数据与算法）视为核心；通用类视为加分
    const isCore = ['前端', '后端', '数据与算法'].includes(meta.category);
    (isCore ? core : plus).push({ canonical, category: meta.category });
  }
  return { core, plus };
}

/** 结构条件：年限与学历（简化模型：JD 标注最低年限/学历，简历标注实际值） */
function structuralScore(jd, resume) {
  let score = 1.0;
  const reasons = [];
  const jdYears = Number(jd.minYears || 0);
  const rYears = Number(resume.years || 0);
  if (jdYears > 0) {
    if (rYears >= jdYears) {
      reasons.push(`年限满足（要求 ${jdYears} 年，实际 ${rYears} 年）`);
    } else {
      score -= 0.5;
      reasons.push(`年限不足（要求 ${jdYears} 年，实际 ${rYears} 年）`);
    }
  }
  const rank = { 不限: 0, 大专: 1, 本科: 2, 硕士: 3, 博士: 4 };
  const need = rank[jd.education || '不限'] ?? 0;
  const have = rank[resume.education || '本科'] ?? 2;
  if (need > 0) {
    if (have >= need) reasons.push(`学历满足（要求 ${jd.education}，实际 ${resume.education}）`);
    else {
      score -= 0.3;
      reasons.push(`学历不满足（要求 ${jd.education}，实际 ${resume.education}）`);
    }
  }
  return { score: Math.max(0, score), reasons };
}

/**
 * 构建 JD→全体简历 的匹配结果。
 * @param {Array} resumes [{id, name, text, years, education}]
 * @param {Object} jd {id, title, text, minYears, education}
 */
function matchJd(jd, resumes) {
  const index = new Bm25Index(resumes.map((r) => ({ id: r.id, text: r.text })));
  const textScores = new Map(index.search(jd.text).map((x) => [x.id, x.score]));
  const { core, plus } = extractJdRequirements(jd.text);

  const results = resumes.map((r) => {
    const { found, evidence } = extractSkills(r.text);

    // 技能分：核心覆盖为主，加分封顶不超过核心缺口的 20%
    let coreHit = 0;
    const coreMiss = [];
    const coreEvidence = [];
    for (const s of core) {
      if (found.has(s.canonical)) {
        coreHit += 1;
        coreEvidence.push({ skill: s.canonical, snippet: evidence.get(s.canonical) });
      } else coreMiss.push(s.canonical);
    }
    let plusHit = 0;
    const plusEvidence = [];
    for (const s of plus) {
      if (found.has(s.canonical)) {
        plusHit += 1;
        plusEvidence.push({ skill: s.canonical, snippet: evidence.get(s.canonical) });
      }
    }
    const coreRate = core.length ? coreHit / core.length : 1;
    const plusRate = plus.length ? plusHit / plus.length : 0;
    // 加分技能只补核心缺口的两成：核心全中时不再叠加，杜绝总分越界
    const skillScore = core.length
      ? coreRate + plusRate * (1 - coreRate) * 0.2
      : Math.min(plusRate, 1) * 0.5;

    const textScore = textScores.get(r.id) || 0;
    const struct = structuralScore(jd, r);

    const total = Math.round(
      Math.min(1, Math.max(0, 0.55 * skillScore + 0.35 * textScore + 0.10 * struct.score)) * 100,
    );

    return {
      resumeId: r.id,
      name: r.name,
      years: r.years,
      education: r.education,
      score: total,
      breakdown: {
        skill: Math.round(skillScore * 100),
        text: Math.round(textScore * 100),
        structural: Math.round(struct.score * 100),
        structuralReasons: struct.reasons,
      },
      coreEvidence,
      plusEvidence,
      gaps: coreMiss,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return { jd: { id: jd.id, title: jd.title }, requirements: { core, plus }, results };
}

module.exports = { matchJd, extractJdRequirements };
