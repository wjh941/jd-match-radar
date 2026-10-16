const test = require('node:test');
const assert = require('node:assert');
const { matchJd, extractJdRequirements } = require('../lib/scorer');
const { RESUMES, JDS } = require('../server/seed');

const jd = JDS.find((j) => j.id === 'j02'); // Java 高级后端：要求 5 年/本科

test('评分确定性：同输入两次结果完全一致', () => {
  const a = matchJd(jd, RESUMES);
  const b = matchJd(jd, RESUMES);
  assert.deepStrictEqual(a, b);
});

test('结果按分数降序且分数在 0~100', () => {
  const { results } = matchJd(jd, RESUMES);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].score >= results[i].score);
  }
  for (const r of results) {
    assert.ok(r.score >= 0 && r.score <= 100, `score out of range: ${r.score}`);
  }
});

test('年限不足会被结构分惩罚并写入理由', () => {
  const { results } = matchJd(jd, RESUMES);
  const junior = results.find((r) => r.resumeId === 'r05'); // 2 年
  assert.ok(junior.breakdown.structural < 100);
  assert.ok(junior.breakdown.structuralReasons.some((x) => x.includes('年限不足')));
});

test('核心技能缺口进入 gaps 清单', () => {
  const { results } = matchJd(jd, RESUMES);
  const frontend = results.find((r) => r.resumeId === 'r01'); // 纯前端，缺 Java/微服务
  assert.ok(frontend.gaps.length > 0);
});

test('JD 需求抽取：技术类进核心、通用类进加分', () => {
  const { core, plus } = extractJdRequirements(jd.text);
  assert.ok(core.some((s) => s.canonical === 'Java'));
  assert.ok(core.some((s) => s.canonical === 'MySQL'));
  assert.ok(plus.length > 0 && core.every((s) => s.category !== '通用'));
});
