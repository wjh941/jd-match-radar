/**
 * 技能词典：分类别维护，含别名归一。
 * 结构：{ category: { canonical: [aliases...] } }
 * 匹配时用"别名->规范名"的映射做最长匹配提取；tokenize 的词库也用它构建。
 */

const SKILLS = {
  前端: {
    React: ['react', 'react.js'],
    Vue: ['vue', 'vue.js', 'vue2', 'vue3'],
    TypeScript: ['typescript', 'ts'],
    JavaScript: ['javascript', 'js', 'es6'],
    小程序: ['小程序', '微信小程序', 'uniapp', 'uni-app', 'taro'],
    CSS: ['css', 'css3', 'less', 'sass', 'scss', 'tailwind'],
    Webpack: ['webpack', 'vite', 'rollup', '构建工具'],
    AntDesign: ['ant design', 'antd', 'ant-design'],
  },
  后端: {
    'Node.js': ['node', 'node.js', 'nodejs', 'express', 'koa', 'nest'],
    Java: ['java', 'spring', 'springboot', 'spring boot'],
    Go: ['golang', 'go语言'],
    Python: ['python', 'python3', 'fastapi', 'flask', 'django'],
    MySQL: ['mysql', 'sql', '数据库'],
    Redis: ['redis', '缓存'],
    MongoDB: ['mongodb', 'mongo'],
    Kafka: ['kafka', '消息队列', 'mq', 'rocketmq'],
    微服务: ['微服务', 'microservice', 'rpc', 'grpc'],
  },
  数据与算法: {
    SQL: ['sql', 'hive', 'hivesql', 'sql优化'],
    pandas: ['pandas', 'numpy'],
    机器学习: ['机器学习', 'machine learning', 'sklearn', 'scikit-learn', 'xgboost', 'lightgbm', '模型训练'],
    深度学习: ['深度学习', 'pytorch', 'tensorflow', '深度模型'],
    数据仓库: ['数据仓库', '数仓', 'dim', 'dwd', 'dws', 'etl', '数据建模'],
    Spark: ['spark', 'pyspark', 'flink', '大数据'],
    'A/B测试': ['a/b测试', 'ab测试', 'a/b实验', 'ab实验', '假设检验'],
    大模型: ['大模型', 'llm', 'rag', 'prompt', 'agent', 'embedding', '向量检索'],
  },
  通用: {
    Git: ['git', 'github', 'gitlab'],
    Linux: ['linux', 'shell', 'bash'],
    Docker: ['docker', '容器', 'k8s', 'kubernetes'],
    CI: ['ci', 'cd', 'github actions', '持续集成', 'jenkins'],
    英语: ['英语', 'cet-6', '六级', '英文'],
    沟通: ['沟通', '跨部门', '协作'],
  },
};

/** 别名（小写）-> { canonical, category } */
const ALIAS_MAP = new Map();
for (const [category, group] of Object.entries(SKILLS)) {
  for (const [canonical, aliases] of Object.entries(group)) {
    // 规范名自身也是别名
    for (const a of new Set([canonical, ...aliases])) {
      ALIAS_MAP.set(a.toLowerCase(), { canonical, category });
    }
  }
}

/** 全部可匹配词（别名 + 规范名），供 tokenize 的最长匹配词库使用 */
const LEXICON = new Set([...ALIAS_MAP.keys()].filter((k) => k.length >= 2));

/** 规范名集合（中文规范名直接参与分词词库） */
const CANONICAL_LEXICON = new Set(
  Object.values(SKILLS).flatMap((g) => Object.keys(g)).filter((n) => /[\u4e00-\u9fff]/.test(n)),
);

/**
 * 从文本提取技能：返回 { found: Map<canonical, {category, count}>, evidence: Map<canonical, 命中片段> }
 */
function extractSkills(text) {
  const lower = String(text || '').toLowerCase();
  const found = new Map();
  const evidence = new Map();
  if (!lower) return { found, evidence };
  for (const [alias, meta] of ALIAS_MAP) {
    let idx = lower.indexOf(alias);
    let count = 0;
    let snippet = null;
    while (idx !== -1) {
      count += 1;
      if (!snippet) {
        snippet = String(text).slice(Math.max(0, idx - 12), idx + alias.length + 12).replace(/\s+/g, ' ').trim();
      }
      idx = lower.indexOf(alias, idx + alias.length);
    }
    if (count > 0) {
      found.set(meta.canonical, { category: meta.category, count });
      if (!evidence.has(meta.canonical)) evidence.set(meta.canonical, snippet);
    }
  }
  return { found, evidence };
}

/** 某类别的全部规范名 */
function skillsInCategory(category) {
  return Object.keys(SKILLS[category] || {});
}

module.exports = { SKILLS, ALIAS_MAP, LEXICON, CANONICAL_LEXICON, extractSkills, skillsInCategory };
