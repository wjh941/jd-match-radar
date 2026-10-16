const test = require('node:test');
const assert = require('node:assert');
const { runEvals } = require('../evals/run-evals');

test('确定性评测门禁：Macro Recall@3 >= 0.9 且 MRR >= 0.85', () => {
  const { macroRecallAt3, macroMrr } = runEvals();
  assert.ok(macroRecallAt3 >= 0.9, `recall@3 = ${macroRecallAt3}`);
  assert.ok(macroMrr >= 0.85, `mrr = ${macroMrr}`);
});

test('评测是纯函数：两次运行结果逐字段一致', () => {
  assert.deepStrictEqual(runEvals(), runEvals());
});
