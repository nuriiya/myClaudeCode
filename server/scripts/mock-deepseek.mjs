// ============================================================
// 模拟 DeepSeek API 服务（仅用于集成测试）
// 根据 system prompt 识别当前 Agent，返回对应的模拟响应
// ============================================================
import http from 'node:http';

const PORT = 3999;

function sseChunk(res, content) {
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/chat/completions') {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      const json = JSON.parse(body || '{}');
      const messages = json.messages || [];
      const system = messages.find(m => m.role === 'system')?.content || '';
      const userMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
      const isStream = json.stream === true;

      const send = (text, done = true) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        // 分片模拟流式输出（注意：必须保留换行符）
        const parts = [];
        for (let i = 0; i < text.length; i += 12) parts.push(text.slice(i, i + 12));
        let i = 0;
        const timer = setInterval(() => {
          if (i < parts.length) {
            sseChunk(res, parts[i]);
            i++;
          } else {
            clearInterval(timer);
            if (done) res.write('data: [DONE]\n\n');
            res.end();
          }
        }, 5);
      };

      // ---------- Agent 判定（注意顺序：codegen 最具体，优先匹配） ----------
      if (system.includes('代码生产 Agent')) {
        send(`[PROJECT_TREE]
server/
  src/
    index.js
client/
  index.html

[FILE_START: package.json]
\`\`\`json
{
  "name": "blog-demo",
  "version": "1.0.0",
  "scripts": { "start": "node src/index.js" }
}
\`\`\`
[FILE_END]

[FILE_START: src/index.js]
\`\`\`js
// 博客系统入口
const http = require('http');
const server = http.createServer((req, res) => {
  res.end('Hello Blog');
});
server.listen(3000, () => console.log('博客服务已启动: http://localhost:3000'));
\`\`\`
[FILE_END]

[FILE_START: client/index.html]
\`\`\`html
<!DOCTYPE html>
<html><head><title>示例博客</title></head>
<body><h1>欢迎访问示例博客</h1></body></html>
\`\`\`
[FILE_END]

项目代码生成完成，共 3 个文件。
[CODEGEN_DONE]`);
        return;
      }

      if (system.includes('对话交互 Agent')) {
        // 开发意图 → 移交需求澄清
        if (/开发|网站|系统|小程序|做一个|写一个|项目/i.test(userMsg)) {
          send('好的，我注意到你想开发一个项目。为了精准梳理需求并生成代码，接下来会进入**需求澄清**环节，我会问你几个问题来完善细节。\n[TRIGGER_AGENT:requirement]');
        } else {
          send('你好！我是对话交互 Agent，有什么可以帮你？可以描述你的开发需求，或随时开始对话。');
        }
        return;
      }

      if (system.includes('需求澄清 Agent')) {
        // 已收集信息注入：判断问到第几轮
        const hasType = system.includes('项目类型：');
        const hasCore = system.includes('核心功能：');
        if (!hasType) {
          // 首问故意用带缩进换行的 JSON（验证后端 extractQA 容错解析）
          send(`我们先明确一下项目的基本类型。
{
  "question": "这个项目的类型是什么？",
  "option": ["网站", "小程序", "桌面工具", "命令行脚本"],
  "or": "其他（可自定义输入）",
  "dimension": "项目类型"
}`);
        } else if (!hasCore) {
          // 第二轮故意在 JSON 后追加多余说明（验证尾部冗余容错）
          send(`很好，接下来了解一下核心功能。
\`\`\`json
{"question": "项目需要实现哪些核心功能？", "option": ["用户注册与登录", "数据展示与检索", "文件上传下载"], "or": "其他（可自定义输入）", "dimension": "核心功能"}
\`\`\`
请直接回复即可。`);
        } else {
          // 信息足够 → 生成需求文档
          send(`# 项目需求架构文档

## 一、项目概述
- 项目名称：示例博客系统
- 项目类型：网站
- 一句话说明：一个支持文章发布与评论的个人博客系统

## 二、目标用户与使用场景
- 个人博主、内容创作者
- 场景：日常写作发布、读者互动

## 三、核心功能需求
1. [P0] 文章发布与管理
2. [P0] 文章列表与详情展示
3. [P1] 读者评论功能
4. [P2] 搜索与标签

## 四、页面/模块结构
- 首页、文章列表页、文章详情页、管理后台

## 五、技术要求
- 前端：HTML/CSS/JavaScript；后端：Node.js

## 六、数据与存储设计
- 文章与评论以 JSON 文件存储

## 七、视觉与交互要求
- 简洁清爽，移动端适配

## 八、交付边界
- 本期不含用户系统；不做多语言

## 九、验收标准
- 文章可发布、可浏览、可评论

{"__doc_ready": true}`);
        }
        return;
      }

      if (system.includes('代码生产 Agent')) {
        send(`[PROJECT_TREE]
server/
  src/
    index.js
client/
  index.html

[FILE_START: package.json]
\`\`\`json
{
  "name": "blog-demo",
  "version": "1.0.0",
  "scripts": { "start": "node src/index.js" }
}
\`\`\`
[FILE_END]

[FILE_START: src/index.js]
\`\`\`js
// 博客系统入口
const http = require('http');
const server = http.createServer((req, res) => {
  res.end('Hello Blog');
});
server.listen(3000, () => console.log('博客服务已启动: http://localhost:3000'));
\`\`\`
[FILE_END]

[FILE_START: client/index.html]
\`\`\`html
<!DOCTYPE html>
<html><head><title>示例博客</title></head>
<body><h1>欢迎访问示例博客</h1></body></html>
\`\`\`
[FILE_END]

项目代码生成完成，共 3 个文件。
[CODEGEN_DONE]`);
        return;
      }

      send('（模拟服务：未知 Agent）');
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => console.log(`Mock DeepSeek 服务已启动: http://localhost:${PORT}`));
