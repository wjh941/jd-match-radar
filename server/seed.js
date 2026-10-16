/**
 * 演示数据种子：10 份候选人简历 + 8 个岗位 JD。
 * 人物与岗位均为虚构，但内容按真实招聘语料的密度撰写——
 * 让检索、技能抽取与差距分析在"真话"上运行，而不是占位符。
 */
const fs = require('node:fs');
const path = require('node:path');

const RESUMES = [
  {
    id: 'r01', name: '陈晓雯', years: 4, education: '本科', title: '前端工程师',
    text: '4 年前端开发经验，精通 React + TypeScript 技术栈，熟悉 Vue3。主导过电商中后台重构，用 React Query 替换手写请求状态，首屏时间从 3.2s 降到 1.4s。搭建过组件库（40+ 组件，Ant Design 二次封装），熟悉 Webpack/Vite 构建优化，曾通过代码分割与按需加载把主包从 1.8MB 降到 620KB。写过 200+ 个 Vitest 单元测试，推动团队测试覆盖率从 0 到 70%。熟悉微信小程序（Taro）与 H5 移动端适配。',
  },
  {
    id: 'r02', name: '李昊然', years: 6, education: '本科', title: 'Java 后端工程师',
    text: '6 年 Java 后端经验，精通 Spring Boot / Spring Cloud 微服务架构。主导过日订单 50 万的订单系统拆分，负责服务治理、限流熔断（Sentinel）与分布式事务（Seata）。数据库 MySQL 索引优化经验丰富，曾把慢查询 P99 从 2.4s 优化到 180ms；熟悉 Redis 缓存设计（缓存击穿/穿透方案）与 Kafka 削峰填谷。带过 5 人小团队，负责 Code Review 与技术方案评审。了解 K8s 部署与 CI/CD 流水线（Jenkins）。',
  },
  {
    id: 'r03', name: '王雨桐', years: 3, education: '硕士', title: '数据分析师',
    text: '3 年数据分析经验，统计学硕士。精通 SQL（Hive/ClickHouse），日常产出留存/转化/漏斗分析。熟练使用 Python（pandas/numpy）做数据处理，matplotlib/Superset 做可视化。设计过 A/B 实验体系：样本量估算、假设检验、SRM 校验，全年推动 40+ 实验落地，其中定价实验带来 6% 营收提升。与产品/研发协作紧密，能把分析结论转化为可执行建议。了解 LightGBM 等机器学习模型在流失预测中的应用。',
  },
  {
    id: 'r04', name: '赵启明', years: 5, education: '硕士', title: '算法工程师',
    text: '5 年机器学习/算法经验。精通 Python + PyTorch，主导过搜索排序模型迭代（XGBoost → 深度排序 DIN），离线 AUC 提升 3.2%，线上 CTR +5.7%。熟悉特征工程全流程（特征仓库、离线在线一致性校验）与模型服务化（ONNX + Triton）。近期在做 LLM 应用：RAG 检索增强的客服知识库（embedding + 向量检索 + 重排），prompt 工程与评测集建设。发表过一篇 KDD Workshop 论文。',
  },
  {
    id: 'r05', name: '林嘉怡', years: 2, education: '本科', title: '前端开发（初级）',
    text: '2 年前端开发经验，熟练使用 Vue3 + JavaScript 开发移动端 H5 与微信小程序。参与过 3 个小程序项目从 0 到 1 上线，负责页面开发、接口联调与埋点。了解 TypeScript 基本用法，正在学习 React。会用 Vite 搭建项目，写基础的单元测试。工作认真，能承受上线压力，期待加入有 Code Review 文化的团队快速成长。',
  },
  {
    id: 'r06', name: '周子墨', years: 7, education: '本科', title: '全栈工程师',
    text: '7 年全栈经验，前端 React/Vue 双栈 + 后端 Node.js（NestJS）+ Python（FastAPI）。独立交付过 SaaS 后台从数据库设计到前端部署的全链路（PostgreSQL + Redis + Docker Compose）。重视工程质量：GitHub Actions CI、ESLint 规范、80% 测试覆盖率。带过 3 人全栈小组，擅长把模糊需求拆成可交付的里程碑。业余维护一个 500 星的开源 CLI 工具。',
  },
  {
    id: 'r07', name: '吴亚楠', years: 4, education: '本科', title: '测试开发工程师',
    text: '4 年测试开发经验。搭建过接口自动化测试框架（Python + pytest + Allure），用例 2000+，回归时间从 2 天缩短到 40 分钟。开发过测试数据工厂与流量回放工具，擅长定位接口性能问题（JMeter + 链路追踪）。熟悉 CI/CD（GitHub Actions / Jenkins）里的质量门禁设计，推动左移测试文化。了解 Docker 与 K8s 基本运维，能自己搭测试环境。',
  },
  {
    id: 'r08', name: '郑安琪', years: 5, education: '本科', title: '数据工程师',
    text: '5 年数据工程经验，专注数据仓库建设与大数据管道。精通 Spark / Flink 实时离线双链路，熟悉 Hive 数仓分层建模（ODS/DWD/DWS/ADS），主导过日增 2 亿事件的实时数仓重构，任务失败率从 5% 降到 0.3%。熟悉数据质量监控（对账系统）与调度（Airflow）。用 Python 写过大量 ETL 与数据校验脚本，了解 Iceberg 湖仓一体。与算法团队协作过特征管道的离线在线一致性改造。',
  },
  {
    id: 'r09', name: '孙浩宇', years: 3, education: '大专', title: '运维工程师（SRE 方向）',
    text: '3 年运维/SRE 经验。负责 200+ 台服务器的 Kubernetes 集群运维，熟悉 Docker 容器化改造与 Helm 发布管理。搭建过 Prometheus + Grafana 监控告警体系与 ELK 日志平台，MTTR 从 45 分钟降到 12 分钟。写过大量 Shell 与 Python 自动化脚本（发布、巡检、成本优化）。推动过混沌演练与备份容灾体系建设。英语读写一般，能看英文文档。',
  },
  {
    id: 'r10', name: '冯芷晴', years: 0, education: '本科', title: '应届生 · 数据方向',
    text: '2026 届应届毕业生，统计学专业。课程项目：用 Python（pandas + LightGBM）完成某电商用户复购预测，AUC 0.86；毕业设计做 A/B 实验平台的原型设计。SQL 熟练（LeetCode 300 题），会基础的 Python 数据分析。自学过 React 做了一个课程表小程序的前端。学习能力强，希望从数据分析或数据工程岗起步。',
  },
];

const JDS = [
  {
    id: 'j01', title: '资深前端工程师（中后台方向）', minYears: 4, education: '本科',
    text: '负责公司核心中后台系统的前端架构与开发。要求：精通 React + TypeScript，有复杂中后台项目经验；熟悉 React Query / 服务端状态管理方案；具备构建优化能力（Webpack/Vite 代码分割、按需加载）；重视工程质量，有单元测试习惯；了解 Ant Design 生态。加分：有组件库建设经验、有性能优化量化成果。',
  },
  {
    id: 'j02', title: 'Java 高级后端工程师（交易方向）', minYears: 5, education: '本科',
    text: '负责交易链路的核心服务开发与治理。要求：精通 Java 与 Spring Boot 微服务架构；深入理解 MySQL 索引与事务，有慢查询优化实战；熟悉 Redis 缓存架构与 Kafka 等消息队列；有高并发场景（限流/熔断/分布式事务）落地经验。加分：带过小团队、有 K8s 与 CI/CD 经验。',
  },
  {
    id: 'j03', title: '数据分析师（增长方向）', minYears: 3, education: '本科',
    text: '负责增长业务的指标体系与分析闭环。要求：SQL 熟练（Hive/ClickHouse 任一）；Python 数据处理（pandas）；有 A/B 实验设计与假设检验实战；能产出漏斗/留存/转化分析与可执行建议。加分：机器学习模型应用经验（流失预测等）、可视化工具（Superset/Tableau）。',
  },
  {
    id: 'j04', title: '算法工程师（推荐/LLM 应用）', minYears: 4, education: '硕士',
    text: '负责推荐排序模型与 LLM 应用落地。要求：精通 Python + PyTorch，有排序模型（XGBoost/深度排序）迭代经验；熟悉特征工程与模型服务化；有 LLM/RAG 应用实践（embedding、向量检索、prompt 工程）者优先；有论文发表加分。',
  },
  {
    id: 'j05', title: '全栈工程师（SaaS 方向）', minYears: 5, education: '不限',
    text: '独立负责 SaaS 产品从数据库到前端的完整交付。要求：前端 React 或 Vue 熟练其一；后端 Node.js 或 Python 熟练其一；熟悉 PostgreSQL/MySQL、Redis 与 Docker；重视 CI/CD 与测试覆盖率；有独立交付完整产品的经历。加分：有开源项目维护经验。',
  },
  {
    id: 'j06', title: '测试开发工程师（效率方向）', minYears: 3, education: '本科',
    text: '负责测试基础设施建设。要求：Python 自动化测试框架经验（pytest 等）；能开发测试工具（数据工厂/流量回放）；熟悉 CI/CD 质量门禁；了解 Docker 与基本容器运维。加分：性能测试经验（JMeter）、推动过左移测试文化。',
  },
  {
    id: 'j07', title: '数据工程师（实时数仓方向）', minYears: 4, education: '本科',
    text: '负责实时/离线数据仓库建设。要求：精通 Spark 或 Flink；熟悉 Hive 数仓分层建模；有数据质量监控与调度系统（Airflow）经验；Python ETL 能力强。加分：湖仓一体（Iceberg）经验、与算法团队协作特征管道的经验。',
  },
  {
    id: 'j08', title: 'SRE 工程师（稳定性方向）', minYears: 3, education: '大专',
    text: '负责 Kubernetes 集群稳定性与可观测性建设。要求：熟悉 K8s 与 Docker 容器化；有 Prometheus + Grafana 监控体系搭建经验；Shell/Python 自动化脚本能力强；有故障演练与容灾建设经验。加分：成本优化、ELK 日志平台、英文文档阅读能力。',
  },
];

/** 真值标注：每个 JD 的合理匹配简历（用于确定性评测）。标注依据：核心技能与结构条件。 */
const GROUND_TRUTH = {
  j01: ['r01', 'r06'], // 前端：陈晓雯(React+TS+测试+优化) / 周子墨(React全栈)
  j02: ['r02'], // Java 交易后端：李昊然
  j03: ['r03', 'r10'], // 数据分析：王雨桐 / 冯芷晴(起步)
  j04: ['r04', 'r03'], // 算法：赵启明 / 王雨桐(模型应用)
  j05: ['r06', 'r02'], // 全栈：周子墨(全栈) / 李昊然(强后端补位)
  j06: ['r07'], // 测试开发：吴亚楠
  j07: ['r08'], // 数据工程：郑安琪
  j08: ['r09'], // SRE：孙浩宇
};

function main() {
  const out = {
    generatedAt: new Date().toISOString(),
    resumes: RESUMES,
    jds: JDS,
    groundTruth: GROUND_TRUTH,
  };
  const file = path.join(__dirname, '..', 'data', 'store.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`已生成: ${file}`);
  console.log(`  简历 ${RESUMES.length} 份 · JD ${JDS.length} 个 · 真值标注 ${Object.keys(GROUND_TRUTH).length} 组`);
}

if (require.main === module) main();
module.exports = { RESUMES, JDS, GROUND_TRUTH };
