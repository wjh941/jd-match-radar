/**
 * API Embedding Provider（BYOK 模式）。
 *
 * 调用 OpenAI 兼容的 /v1/embeddings 端点生成语义向量。
 * 与本地 bigram 向量的区别：语义 embedding 能捕捉"负责数据库"和"数据仓库"
 * 的语义关联（没有共同关键词但语义相近），而 bigram 只能做字面匹配。
 *
 * 没配 key 时返回 null——调用方回退到 bigram 向量，功能不受影响。
 * Key 存环境变量 EMBEDDING_API_KEY / EMBEDDING_BASE_URL / EMBEDDING_MODEL，
 * 不落盘、不进代码。
 */

const DEFAULT_BASE = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'text-embedding-3-small';

class ApiEmbedder {
  constructor({ apiKey, baseUrl, model } = {}) {
    this.apiKey = apiKey || process.env.EMBEDDING_API_KEY || '';
    this.baseUrl = (baseUrl || process.env.EMBEDDING_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
    this.model = model || process.env.EMBEDDING_MODEL || DEFAULT_MODEL;
  }

  get available() {
    return !!this.apiKey;
  }

  /**
   * 批量生成向量。
   * @param {string[]} texts
   * @returns {Promise<Array<Float32Array|null>>} 与输入一一对应的向量数组；失败的为 null
   */
  async embedBatch(texts) {
    if (!this.apiKey || !texts.length) return texts.map(() => null);
    try {
      const res = await fetch(this.baseUrl + '/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts.map(t => t.slice(0, 8000)), // API token 限制
        }),
      });
      if (!res.ok) throw new Error(`embedding API ${res.status}`);
      const data = await res.json();
      // API 返回顺序可能乱序，按 index 排序
      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map(d => new Float32Array(d.embedding));
    } catch {
      return texts.map(() => null);
    }
  }

  /** 余弦相似度 */
  static cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom ? dot / denom : 0;
  }
}

module.exports = { ApiEmbedder };
