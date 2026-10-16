/**
 * 中文/混合文本分词。
 *
 * 零依赖的务实方案（分层）：
 * 1. 拉丁词：react / vue3 / node.js / k8s / CI 整词保留（小写、保留内部 .+# 等连接符）
 * 2. 词库最长匹配：技能/职位等"硬词"优先于切分（见 skills.js 提供的词表）
 * 3. 兜底：剩余中文串按二元组（bigram）切分——无词典时 BM25 依然有稳定区分度
 *
 * 为什么不用 jieba：零依赖是本项目的明确卖点；bigram + 硬词词典在实际简历语料上
 * 的检索质量已够用（见 evals/ 的确定性指标），且避免了 native 依赖的安装成本。
 */

/** 拉丁/数字词（含 js 内部连接符） */
const LATIN_RE = /[a-zA-Z0-9][a-zA-Z0-9+.#\-]*/g;
const CJK_RE = /[\u4e00-\u9fff]+/g;

/** 停用词：拉丁侧常见噪音 */
const STOP = new Set(['the', 'and', 'for', 'with', 'of', 'to', 'in', 'a', 'an', 'or']);

/**
 * 把一段中文串切成二元组。
 * "负责数据仓库建设" -> 负责 / 载数 / 数据 / 据仓 / 仓库 / 库建 / 建设
 */
function bigrams(cjkRun) {
  const out = [];
  if (cjkRun.length === 1) {
    out.push(cjkRun);
    return out;
  }
  for (let i = 0; i < cjkRun.length - 1; i++) out.push(cjkRun.slice(i, i + 2));
  return out;
}

/**
 * 分词主入口。
 * @param {string} text 任意中英混合文本
 * @param {Set<string>} [lexicon] 词库最长匹配优先（可传技能/职位词典并集）
 * @returns {string[]} token 数组（未去重）
 */
function tokenize(text, lexicon) {
  const tokens = [];
  const raw = String(text || '');
  if (!raw) return tokens;

  // 1. 拉丁词
  for (const m of raw.matchAll(LATIN_RE)) {
    const w = m[0].toLowerCase();
    if (w.length >= 2 && !STOP.has(w)) tokens.push(w);
  }

  // 2. 中文：先做词库最长匹配（可达 8 字），命中段整段成 token；未命中的段再切 bigram
  const cjkRuns = raw.match(CJK_RE) || [];
  for (const run of cjkRuns) {
    let i = 0;
    let tail = '';
    while (i < run.length) {
      let hit = null;
      if (lexicon) {
        const maxLen = Math.min(8, run.length - i);
        for (let len = maxLen; len >= 2; len--) {
          const cand = run.slice(i, i + len);
          if (lexicon.has(cand)) {
            hit = cand;
            break;
          }
        }
      }
      if (hit) {
        if (tail) {
          tokens.push(...bigrams(tail));
          tail = '';
        }
        tokens.push(hit);
        i += hit.length;
      } else {
        tail += run[i];
        i += 1;
      }
    }
    if (tail) tokens.push(...bigrams(tail));
  }

  return tokens;
}

module.exports = { tokenize, bigrams };
