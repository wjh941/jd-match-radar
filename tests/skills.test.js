const test = require('node:test');
const assert = require('node:assert');
const { extractSkills } = require('../lib/skills');

test('别名归一到规范名：js -> JavaScript', () => {
  const { found } = extractSkills('精通 js 与 react，写过 vue');
  assert.ok(found.has('JavaScript'));
  assert.ok(found.has('React'));
  assert.ok(found.has('Vue'));
});

test('evidence 记录命中片段', () => {
  const { evidence } = extractSkills('负责 MySQL 索引优化，把慢查询降到 180ms');
  assert.ok(evidence.has('MySQL'));
  assert.ok(evidence.get('MySQL').includes('索引优化'));
});

test('大小写不敏感：PYTHON 也能命中', () => {
  const { found } = extractSkills('PYTHON 数据处理');
  assert.ok(found.has('Python'));
});
