// ============================================================
// 坏格式模拟服务（仅用于自愈机制验证，端口 3998）
// 行为：需求澄清第二轮故意输出截断的代码块（模拟模型失格），
//       收到系统「格式修复提示」后恢复规范 JSON 输出
// ============================================================
import http from 'node:http';

const PORT = 3998;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/chat/completions') {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      const json = JSON.parse(body || '{}');
      const messages = json.messages || [];
      const system = messages.find(m => m.role === 'system')?.content || '';

      const send = (text) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const parts = [];
        for (let i = 0; i < text.length; i += 12) parts.push(text.slice(i, i + 12));
        let i = 0;
        const timer = setInterval(() => {
          if (i < parts.length) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: parts[i] } }] })}\n\n`);
            i++;
          } else {
            clearInterval(timer);
            res.write('data: [DONE]\n\n');
            res.end();
          }
        }, 3);
      };

      // 判定顺序：对话 Agent 优先（其 system 文本可能包含其他 Agent 名称）
      if (system.includes('对话交互 Agent')) {
        send('好的，我注意到你想开发一个项目，接下来进入需求澄清环节。\n[TRIGGER_AGENT:requirement]');
        return;
      }

      if (system.includes('需求澄清 Agent')) {
        const hasType = system.includes('项目类型：');
        const hasCore = system.includes('核心功能：');
        const hasFix = system.includes('格式修复提示');
        if (!hasType) {
          // 首问：规范格式
          send('先确认项目类型。\n{"question": "项目类型是什么？", "option": ["网站", "桌面工具"], "dimension": "项目类型"}');
        } else if (!hasCore && !hasFix) {
          // 第二轮：未收到修复提示 → 输出坏格式（截断的 markdown 代码块）
          send('好的，已记录项目类型。接下来了解一下核心功能。\n```j');
        } else if (!hasCore && hasFix) {
          // 第三轮：收到修复提示 → 恢复规范输出
          send('好的，我将严格按规范输出。\n{"question": "需要哪些核心功能？", "option": ["用户登录", "数据管理"], "dimension": "核心功能"}');
        } else {
          // 信息足够 → 需求文档
          send('# 项目需求架构文档\n\n## 一、项目概述\n- 项目名称：自愈测试项目\n- 项目类型：网站\n\n## 九、验收标准\n- 功能可用\n\n{"__doc_ready": true}');
        }
        return;
      }

      if (system.includes('对话交互 Agent')) {
        send('好的，我注意到你想开发一个项目，接下来进入需求澄清环节。\n[TRIGGER_AGENT:requirement]');
        return;
      }

      send('（模拟服务：未知 Agent）');
    });
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => console.log(`Broken-format Mock 服务已启动: http://localhost:${PORT}`));
