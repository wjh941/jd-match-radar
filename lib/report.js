/**
 * 匹配结果 → Markdown 报告。
 * 场景：把一次匹配的结果归档/粘贴给用人经理，格式稳定、无样式依赖。
 */

const esc = (t) => String(t ?? '').replace(/\|/g, '\\|');

/**
 * @param {Object} matchResult matchJd() 的返回值
 * @returns {string} Markdown 文本
 */
function toMarkdown(matchResult) {
  const { jd, requirements, results } = matchResult;
  const lines = [];
  lines.push(`# 匹配报告 · ${jd.title}`);
  lines.push('');
  lines.push(`> 生成时间：${new Date().toISOString()} · 岗位匹配雷达`);
  lines.push('');

  if (requirements.core.length) {
    lines.push(
      `**核心技能要求**：${requirements.core.map((s) => s.canonical).join('、')}`,
    );
  }
  if (requirements.plus.length) {
    lines.push(
      `**加分项**：${requirements.plus.map((s) => s.canonical).join('、')}`,
    );
  }
  lines.push('');
  lines.push('## 排名总览');
  lines.push('');
  lines.push('| # | 候选人 | 年限 | 学历 | 总分 | 技能 | 文本 | 结构 | 缺口 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  results.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${esc(r.name)} | ${r.years} 年 | ${esc(r.education)} | **${r.score}** |`
        + ` ${r.breakdown.skill} | ${r.breakdown.text} | ${r.breakdown.structural} |`
        + ` ${r.gaps.length ? esc(r.gaps.join('、')) : '—'} |`,
    );
  });

  lines.push('');
  lines.push('## 逐人证据');
  for (const r of results) {
    lines.push('');
    lines.push(`### ${r.name}（${r.score} 分）`);
    if (r.coreEvidence.length) {
      for (const e of r.coreEvidence) {
        lines.push(`- ✅ **${e.skill}**：…${e.snippet}…`);
      }
    } else {
      lines.push('- （无核心技能命中）');
    }
    if (r.gaps.length) {
      lines.push(`- ⚠ 缺口：${r.gaps.join('、')}`);
    }
    if (r.breakdown.structuralReasons.length) {
      for (const reason of r.breakdown.structuralReasons) {
        lines.push(`- ℹ ${reason}`);
      }
    }
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = { toMarkdown };
