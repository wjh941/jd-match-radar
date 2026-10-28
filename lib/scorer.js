/**
 * 可解释匹配评分器（混合检索版）。
 *
 * 总分 = 0.55 × 技能分 + 0.35 × 文本分 + 0.10 × 结构分，输出 0~100。
 * - 技能分：JD 抽取出的核心技能（权重 3）与加分技能（权重 1）在简历中的覆盖率
 * - 文本分：RRF 融合 BM25(词级精确) + 字符 bigram 向量(子词语义) 的混合排名
 * - 结构分：学历/年限等结构化条件的满足度
 * 每一维都输出依据（命中证据/缺口清单），评分永远可解释——这是与"黑盒打分"的区别。
 */

const { extractSkills, skillsInCategory } = require('./skills');
const { HybridIndex } = require('./hybrid-search');
const { ApiEmbedder } = require('./api-embedder');

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

/** 共享主体：给定"简历ID→文本分"映射，计算技能/文本/结构三维评分与证据 */
function matchFromTextScores(jd, resumes, textScores) {
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

/** RRF 融合排名 → "简历ID→归一文本分" 映射 */
function fusedToTextScores(fused) {
  const maxFused = fused[0]?.score || 1;
  return new Map(fused.map((x) => [x.id, x.score / maxFused]));
}

/**
 * 构建 JD→全体简历 的匹配结果（同步双通道：BM25 + bigram 向量）。
 * @param {Array} resumes [{id, name, text, years, education}]
 * @param {Object} jd {id, title, text, minYears, education}
 */
function matchJd(jd, resumes) {
  const hybrid = new HybridIndex(resumes.map((r) => ({ id: r.id, text: r.text })));
  return matchFromTextScores(jd, resumes, fusedToTextScores(hybrid.search(jd.text)));
}

/**
 * 深度匹配：叠加 API Embedding 语义通道（BYOK）。
 * 未配置 Key 或调用失败时自动退化为双通道，结果结构与 matchJd 完全一致，额外带 deep 标记。
 * @param {Object} jd 同 matchJd
 * @param {Array} resumes 同 matchJd
 * @param {Object|ApiEmbedder} embedderOpts {apiKey, baseUrl, model} 或 ApiEmbedder 实例
 */
async function matchJdDeep(jd, resumes, embedderOpts) {
  const hybrid = new HybridIndex(resumes.map((r) => ({ id: r.id, text: r.text })));
  const attached = await hybrid.attachEmbeddings(embedderOpts || {});
  const fused = await hybrid.searchDeep(jd.text);
  const result = matchFromTextScores(jd, resumes, fusedToTextScores(fused));
  result.deep = attached;
  return result;
}

module.exports = { matchJd, matchJdDeep, extractJdRequirements };
