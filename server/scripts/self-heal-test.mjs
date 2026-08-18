// ============================================================
// 自愈机制端到端验证（需后端以 DEEPSEEK_API_BASE=http://localhost:3998 启动）
// 场景：模型第二轮输出坏格式 → 系统打自愈标记 → 下一轮注入修复提示
//       → 模型恢复规范输出 → 标记清除 → 正常生成需求文档
// 运行：node scripts/self-heal-test.mjs
// ============================================================
const BASE = 'http://localhost:3002/api';

async function api(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json();
  if (body.code !== 0) throw new Error(`[${url}] ${body.message}`);
  return body.data;
}

async function sse(url, body) {
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const events = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let current = null;
  const flush = () => { if (current) events.push(current); current = null; };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = 'message', data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data = line.slice(5).trim();
      }
      if (!data || !data.startsWith('{')) continue;
      flush();
      current = { event, data: JSON.parse(data) };
    }
  }
  flush();
  return events;
}

function lastMsgEnd(events) {
  return [...events].reverse().find(e => e.event === 'msg_end');
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

(async () => {
  console.log('\n========== 自愈机制端到端验证 ==========\n');

  // 1. 创建主题并发起需求
  const topic = await api('/topics', { method: 'POST', body: JSON.stringify({ title: '自愈测试' }) });
  console.log('[1] 发起开发需求');
  let ev = await sse('/chat', { topicId: topic.id, content: '帮我开发一个网站' });
  let ends = ev.filter(e => e.event === 'msg_end');
  check('对话移交 + 需求澄清首问(QA)', ends.length === 2 && !!ends[1]?.data?.meta?.qa);

  // 2. 回答项目类型 → 模型第二轮输出坏格式
  console.log('\n[2] 回答项目类型 → 期望模型坏格式回复');
  ev = await sse('/chat/answer', { topicId: topic.id, answer: '网站' });
  const brokenEnd = lastMsgEnd(ev);
  check('第二轮无 QA 结构（坏格式未解析）', !brokenEnd?.data?.meta?.qa);
  let t = await api(`/topics/${topic.id}`);
  check('自愈标记已打上 lastFormatError=true', t.req_state?.lastFormatError === true);
  console.log(`  坏格式回复内容: ${String(brokenEnd?.data?.content).replace(/\n/g, ' ').slice(0, 60)}…`);

  // 3. 用户继续输入 → 系统注入修复提示 → 模型恢复规范输出
  console.log('\n[3] 用户继续输入 → 期望模型收到修复提示后规范输出');
  ev = await sse('/chat/answer', { topicId: topic.id, answer: '帮我继续' });
  const fixedEnd = lastMsgEnd(ev);
  check('第三轮恢复 QA 结构（核心功能）', fixedEnd?.data?.meta?.qa?.dimension === '核心功能');
  t = await api(`/topics/${topic.id}`);
  check('自愈标记已清除 lastFormatError=false', t.req_state?.lastFormatError === false);
  check('提问记录含两轮问题', t.req_state?.asked?.length === 2);

  // 4. 回答核心功能 → 文档就绪
  console.log('\n[4] 回答核心功能 → 需求文档生成');
  ev = await sse('/chat/answer', { topicId: topic.id, answer: '用户登录和数据管理' });
  const docEnd = lastMsgEnd(ev);
  check('需求文档就绪', docEnd?.data?.meta?.docReady === true);
  t = await api(`/topics/${topic.id}`);
  check('阶段流转为 docs', t.stage === 'docs');

  // 清理
  await api(`/topics/${topic.id}`, { method: 'DELETE' });

  console.log(`\n结果: ${pass} / ${pass + fail} 通过`);
  if (fail > 0) { console.log(`失败: ${fail}`); process.exit(1); }
})().catch(e => { console.error('测试异常:', e.message); process.exit(1); });
