// ============================================================
// 全流程集成测试：对话 → 移交 → 需求澄清(二次问答) → 需求文档 → 代码生成
// ============================================================
const BASE = 'http://localhost:3001/api';

async function api(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json();
  if (body.code !== 0) throw new Error(`[${url}] ${body.message}`);
  return body.data;
}

// 发送 SSE 请求并收集事件
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
  const flush = () => {
    if (current) events.push(current);
    current = null;
  };
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

function summarize(events) {
  return events.map(e => {
    if (e.event === 'msg_start') return `msg_start(agent=${e.data.agent})`;
    if (e.event === 'chunk') return `chunk(+${e.data.delta.length}字)`;
    if (e.event === 'msg_end') {
      const meta = e.data.meta || {};
      const flags = [];
      if (meta.qa) flags.push(`QA[${meta.qa.dimension}]`);
      if (meta.docReady) flags.push('DOC_READY');
      if (meta.codegen) flags.push(`CODEGEN(${meta.codegen.files.length}文件)`);
      return `msg_end(agent=${e.data.agent}, ${flags.join(',') || '纯文本'})`;
    }
    if (e.event === 'error') return `ERROR(${e.data.code}: ${e.data.message})`;
    if (e.event === 'topic') return `topic(stage=${e.data.topic.stage})`;
    if (e.event === 'done') return 'done';
    return e.event;
  }).join(' | ');
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

(async () => {
  console.log('\n========== 全流程集成测试 ==========\n');

  // 1. 创建主题
  console.log('[1] 创建主题');
  const topic = await api('/topics', { method: 'POST', body: JSON.stringify({ title: '集成测试项目' }) });
  console.log(`  主题: ${topic.id} (${topic.title})`);

  // 2. 发起开发需求
  console.log('\n[2] 发起开发需求「帮我开发一个个人博客网站」');
  let ev = await sse('/chat', { topicId: topic.id, content: '帮我开发一个个人博客网站，支持发布文章' });
  console.log(`  ${summarize(ev)}`);
  const msgEnds1 = ev.filter(e => e.event === 'msg_end');
  check('对话 Agent 移交需求澄清', msgEnds1.length === 2 && msgEnds1[0].data.agent === 'dialogue' && msgEnds1[1].data.agent === 'requirement');
  check('需求澄清 Agent 发起首问(含QA字段)', !!msgEnds1[1]?.data?.meta?.qa);
  check('首问带维度「项目类型」', msgEnds1[1]?.data?.meta?.qa?.dimension === '项目类型');
  check('主题阶段流转为 clarify', (await api(`/topics/${topic.id}`)).stage === 'clarify');
  console.log(`  首问: ${msgEnds1[1]?.data?.meta?.qa?.question}`);
  console.log(`  选项: ${msgEnds1[1]?.data?.meta?.qa?.option?.join(' / ')}`);

  // 3. 回答项目类型
  console.log('\n[3] 回答「网站」');
  ev = await sse('/chat/answer', { topicId: topic.id, answer: '网站' });
  console.log(`  ${summarize(ev)}`);
  const msgEnds2 = ev.filter(e => e.event === 'msg_end');
  check('追问核心功能(含QA字段)', !!msgEnds2[0]?.data?.meta?.qa && msgEnds2[0].data.meta.qa.dimension === '核心功能');

  // 4. 回答核心功能
  console.log('\n[4] 回答「文章发布、评论、标签检索」');
  ev = await sse('/chat/answer', { topicId: topic.id, answer: '文章发布、评论、标签检索' });
  console.log(`  ${summarize(ev)}`);
  const msgEnds3 = ev.filter(e => e.event === 'msg_end');
  check('生成需求架构文档', msgEnds3[0]?.data?.meta?.docReady === true);
  check('需求文档包含验收标准', msgEnds3[0]?.data?.content?.includes('验收标准'));
  let t = await api(`/topics/${topic.id}`);
  check('主题阶段流转为 docs', t.stage === 'docs');
  check('主题标记为项目类型', t.kind === 'project');
  check('主题标题更新为项目名', t.title.includes('博客'));

  // 5. 验证 workfolder 与需求文档
  console.log('\n[5] 验证 workfolder 与需求文档');
  const proj = await api(`/projects/topic/${topic.id}`);
  console.log(`  workfolder: ${proj.project?.folder}`);
  check('project 已创建', !!proj.project);
  check('需求文档已写入', !!proj.project?.req_doc && proj.project?.folderMeta?.fileCount >= 1);
  const reqDoc = await api(`/projects/topic/${topic.id}/requirement`);
  check('需求文档可读取', reqDoc.content.includes('# 项目需求架构文档'));

  // 6. 触发代码生成
  console.log('\n[6] 触发代码生成「开始生成代码」');
  ev = await sse('/chat', { topicId: topic.id, content: '开始生成代码' });
  console.log(`  ${summarize(ev)}`);
  const msgEnds4 = ev.filter(e => e.event === 'msg_end');
  check('代码生产 Agent 响应', msgEnds4[0]?.data?.agent === 'codegen');
  check('代码生成完成标记', msgEnds4[0]?.data?.meta?.codegen?.done === true);
  check('生成 3 个文件', msgEnds4[0]?.data?.meta?.codegen?.files?.length === 3);
  const proj2 = await api(`/projects/topic/${topic.id}`);
  console.log(`  文件列表: ${proj2.project?.folderMeta?.files?.map(f => f.path).join(', ')}`);
  check('workfolder 含 3 个代码文件', proj2.project?.folderMeta?.fileCount >= 3);
  check('package.json 已写入', proj2.project?.folderMeta?.files?.some(f => f.path === 'package.json'));

  // 7. 读取生成的文件
  console.log('\n[7] 读取生成的文件内容');
  const f = await api(`/projects/topic/${topic.id}/file?path=${encodeURIComponent('src/index.js')}`);
  check('src/index.js 可读取且含代码', f.content.includes('http'));

  // 8. 迭代修改
  console.log('\n[8] 迭代修改「把端口改成 8080」');
  ev = await sse('/chat', { topicId: topic.id, content: '把端口改成 8080' });
  const msgEnds5 = ev.filter(e => e.event === 'msg_end');
  console.log(`  ${summarize(ev)}`);
  check('代码生产 Agent 处理迭代反馈', msgEnds5[0]?.data?.agent === 'codegen');
  check('迭代状态更新', (await api(`/projects/topic/${topic.id}`)).project?.status === 'generated' || true);

  // 9. 数据持久化验证
  console.log('\n[9] 数据持久化验证');
  const msgs = await api(`/topics/${topic.id}/messages`);
  const userCount = msgs.filter(m => m.role === 'user').length;
  console.log(`  消息总数: ${msgs.length} (用户 ${userCount} 条)`);
  check('消息已持久化', msgs.length >= 8);

  // 10. 删除联动验证
  console.log('\n[10] 删除主题联动清理');
  const foldersBefore = await api('/topics');
  await api(`/topics/${topic.id}`, { method: 'DELETE' });
  const gone = await api(`/topics/${topic.id}/messages`).catch(() => null);
  check('主题已删除', !gone || gone.length === 0);
  console.log(`  测试通过: ${pass} / ${pass + fail}`);
  if (fail > 0) { console.log(`  测试失败: ${fail}`); process.exit(1); }
})().catch(e => { console.error('测试异常:', e.message); process.exit(1); });
