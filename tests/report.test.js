const test = require('node:test');
const assert = require('node:assert');
const { toMarkdown } = require('../lib/report');
const { RESUMES, JDS } = require('../server/seed');
const { matchJd } = require('../lib/scorer');

test('Markdown 报告：含排名表/证据/缺口，管道符被转义', () => {
  const jd = JDS.find((j) => j.id === 'j02');
  const md = toMarkdown(matchJd(jd, RESUMES));
  assert.ok(md.includes('# 匹配报告 · Java 高级后端工程师'));
  assert.ok(md.includes('| # | 候选人 |'));
  assert.ok(md.includes('✅ **MySQL**') || md.includes('✅ **Redis**') || md.includes('核心技能命中'));
  assert.ok(!md.startsWith('[object'));
  // 证据片段里的竖线不应破坏表格
  assert.ok(md.split('\n').filter((l) => l.startsWith('| ')).length >= 10);
});

test('无核心命中时输出占位而不是空段落', () => {
  const fake = {
    jd: { id: 'x', title: '测试岗' },
    requirements: { core: [], plus: [] },
    results: [
      {
        resumeId: 'r', name: '张三|李四', years: 1, education: '本科', score: 10,
        breakdown: { skill: 0, text: 10, structural: 100, structuralReasons: ['年限不足（要求 3 年，实际 1 年）'] },
        coreEvidence: [], plusEvidence: [], gaps: ['React'],
      },
    ],
  };
  const md = toMarkdown(fake);
  assert.ok(md.includes('张三\|李四'), '姓名中的管道必须转义');
  assert.ok(md.includes('无核心技能命中'));
  assert.ok(md.includes('缺口：React'));
});
