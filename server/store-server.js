/**
 * 岗位匹配雷达 · HTTP 服务（零依赖）。
 * 路由：
 *   GET  /                    静态单页 UI
 *   GET  /api/health          健康检查
 *   GET  /api/jds             JD 列表（id/标题/年限/学历）
 *   GET  /api/match/:jdId     该 JD 对全部候选人的可解释匹配结果
 *   GET  /api/evals           确定性评测摘要（Recall@3 / MRR）
 *   POST /api/comment         可选 LLM 评语（BYOK：key 经 x-api-key 头传入，不落盘）
 * 端口：PORT 环境变量，默认 4330。
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { RESUMES, JDS } = require('../server/seed');
const { matchJd } = require('../lib/scorer');
const { runEvals } = require('../evals/run-evals');
const { toMarkdown } = require('../lib/report');

const PORT = Number(process.env.PORT) || 4330;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const headers = {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
  if (status === 200 && type.startsWith('text/html')) headers['Cache-Control'] = 'no-cache';
  res.writeHead(status, headers);
  res.end(body);
}

/** 可选 LLM 评语：调 OpenAI 兼容 /chat/completions，失败返回友好错误 */
async function llmComment(jd, resume, apiKey, baseUrl, model) {
  const prompt = `你是资深技术招聘官。根据岗位与候选人简历，写一段 80 字以内的中文匹配评语：先给结论（强烈推荐/推荐/谨慎），再点出最核心的两条匹配证据与一条最大差距。只输出评语本身。\n\n【岗位】${jd.title}：${jd.text.slice(0, 300)}\n\n【候选人】${resume.name}（${resume.years} 年，${resume.education}）：${resume.text.slice(0, 500)}`;
  const url = `${(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 300,
    }),
  });
  if (!res.ok) throw new Error(`LLM 服务异常(${res.status})`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, JSON.stringify({ ok: true, resumes: RESUMES.length, jds: JDS.length }));
    }

    if (req.method === 'GET' && url.pathname === '/api/jds') {
      return send(
        res,
        200,
        JSON.stringify({
          jds: JDS.map(({ id, title, minYears, education }) => ({ id, title, minYears, education })),
        }),
      );
    }

    const matchMatch = url.pathname.match(/^\/api\/match\/([\w-]+)$/);
    if (req.method === 'GET' && matchMatch) {
      const jd = JDS.find((j) => j.id === matchMatch[1]);
      if (!jd) return send(res, 404, JSON.stringify({ error: 'JD 不存在' }));
      const result = matchJd(jd, RESUMES);
      if (url.searchParams.get('format') === 'md') {
        // Markdown 归档/粘贴给用人经理（借鉴简历匹配类工具的报告导出惯例）
        return send(res, 200, toMarkdown(result), 'text/markdown; charset=utf-8');
      }
      return send(res, 200, JSON.stringify(result));
    }

    if (req.method === 'GET' && url.pathname === '/api/evals') {
      const { macroRecallAt3, macroMrr, perJd } = runEvals();
      return send(res, 200, JSON.stringify({ macroRecallAt3, macroMrr, perJd }));
    }

    if (req.method === 'POST' && url.pathname === '/api/comment') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 100_000) req.destroy();
      });
      req.on('end', async () => {
        try {
          const { jdId, resumeId, apiKey, baseUrl, model } = JSON.parse(body || '{}');
          const key = String(apiKey || req.headers['x-api-key'] || '').trim();
          if (!key) return send(res, 400, JSON.stringify({ error: '缺少 API Key（界面右上角配置，仅存本机浏览器）' }));
          const jd = JDS.find((j) => j.id === jdId);
          const resume = RESUMES.find((r) => r.id === resumeId);
          if (!jd || !resume) return send(res, 404, JSON.stringify({ error: 'JD 或候选人不存在' }));
          const comment = await llmComment(jd, resume, key, baseUrl, model);
          send(res, 200, JSON.stringify({ comment }));
        } catch (error) {
          send(res, 502, JSON.stringify({ error: `评语生成失败：${error.message}` }));
        }
      });
      return;
    }

    // 静态文件（白名单目录，防穿越）
    if (req.method === 'GET') {
      let rel = url.pathname === '/' ? '/index.html' : url.pathname;
      rel = path.normalize(rel).replace(/^([.][.][\\/])+/, '');
      const file = path.join(PUBLIC_DIR, rel);
      if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'forbidden', 'text/plain; charset=utf-8');
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
      }
      return send(res, 404, 'not found', 'text/plain; charset=utf-8');
    }

    send(res, 405, JSON.stringify({ error: 'method not allowed' }));
  } catch (error) {
    send(res, 500, JSON.stringify({ error: `服务内部错误：${error.message}` }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[岗位匹配雷达] http://127.0.0.1:${PORT}/`);
  console.log(`  简历 ${RESUMES.length} 份 · JD ${JDS.length} 个 · 零 npm 依赖`);
});
