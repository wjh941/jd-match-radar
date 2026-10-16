const test = require('node:test');
const assert = require('node:assert');
const { tokenize, bigrams } = require('../lib/tokenize');
const { LEXICON, CANONICAL_LEXICON } = require('../lib/skills');

test('拉丁词保留并小写、丢弃单字符与停用词', () => {
  const t = tokenize('React and Vue3 + K8s a I', new Set());
  assert.ok(t.includes('react'));
  assert.ok(t.includes('vue3'));
  assert.ok(t.includes('k8s'));
  assert.ok(!t.includes('a'));
  assert.ok(!t.includes('and'));
});

test('中文按二元组切分', () => {
  assert.deepStrictEqual(bigrams('数据'), ['数据']);
  assert.deepStrictEqual(bigrams('数据仓库'), ['数据', '据仓', '仓库']);
});

test('词库最长匹配优先于 bigram', () => {
  const lex = new Set([...LEXICON, ...CANONICAL_LEXICON]);
  const t = tokenize('数据仓库建设与机器学习平台', lex);
  assert.ok(t.includes('数据仓库'), '词库词应整段保留');
  assert.ok(t.includes('机器学习'));
  assert.ok(!t.includes('据仓'), '词库命中段不应再被切碎');
});

test('空输入返回空数组', () => {
  assert.deepStrictEqual(tokenize(''), []);
  assert.deepStrictEqual(tokenize(null), []);
});
