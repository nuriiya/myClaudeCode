import fs from 'node:fs';
import path from 'node:path';
import { AGENTS_CONFIG_DIR, AGENT_SCENARIO } from '../config.js';
import { Topics, Messages, Projects } from '../db.js';
import * as deepseek from '../services/deepseek.js';
import * as wf from '../services/workfolder.js';

// ============================================================
// AgentManager — 多 Agent 协同编排核心
// - Agent 定义由独立 MD 配置文档驱动（configs/*.md）
// - 预留扩展位：新增 Agent 只需在 AGENT_DEFS 注册 + 提供 MD 配置
// - 路由规则：按 topic.stage 将消息分发给对应 Agent
// ============================================================

const AGENT_DEFS = {
  dialogue: {
    name: '对话交互 Agent',
    file: 'dialogue.md',
    scenario: 'dialog',
    icon: '💬',
    desc: '承接日常对话与基础答疑，检测到开发意图时引导至需求澄清'
  },
  requirement: {
    name: '需求澄清 Agent',
    file: 'requirement.md',
    scenario: 'reasoning',
    icon: '📋',
    desc: '多轮主动提问，拆解模糊需求，产出结构化需求架构文档'
  },
  codegen: {
    name: '代码生产 Agent',
    file: 'codegen.md',
    scenario: 'reasoning',
    icon: '⚙️',
    desc: '基于需求文档在独立 workfolder 中自动化生成项目代码'
  }
};

// 阶段流转图（用于 Agent 联动上下文）
const STAGE_DESC = {
  chat: '日常对话阶段（对话交互 Agent 主导）',
  clarify: '需求澄清阶段（需求澄清 Agent 主导，正在多轮提问补全需求）',
  docs: '需求文档已生成，等待用户确认开始代码生成',
  codegen: '代码生产阶段（代码生产 Agent 主导，正在生成或迭代代码）'
};

// 用户指令识别
const CODEGEN_TRIGGER_RE = /(开始生成|生成代码|开始开发|开始做|开始吧|动手吧|动手|生成项目|开始写|现在开始|可以了|没问题|开始|生成吧|go ahead|start|let'?s go)/i;
const ITERATION_RE = /(修改|优化|调整|加个|增加|去掉|删除|更新|换成|改成|问题|报错|错误|不行|不对|完善|补充|改进|改一下|修复|改动|fix|update|change|improve|add|remove)/i;

// ---------- 结构化字段解析 ----------

// 从文本中提取含指定键的完整 JSON 对象（括号配对法，容错键前空格/缩进/
// markdown 代码围栏/JSON 后跟多余文本）。从后往前尝试每个 { 起始位置。
// 返回 { obj, start, end } 或 null（start 为 JSON 在原文中的起始下标）
export function extractJsonObject(text, requiredKey) {
  if (!text) return null;
  const starts = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') starts.push(i);
  }
  // 从后往前尝试：越靠后的 { 越可能是协议 JSON 的起始
  for (let i = starts.length - 1; i >= 0; i--) {
    const start = starts[i];
    let depth = 0, inStr = false, escaped = false, jsonEnd = -1;
    for (let j = start; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') {
        inStr = true;
      } else if (c === '{') {
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0) { jsonEnd = j + 1; break; }
      }
    }
    if (jsonEnd === -1) continue;
    try {
      const obj = JSON.parse(text.slice(start, jsonEnd));
      if (obj && typeof obj === 'object' && !Array.isArray(obj)
        && (requiredKey ? (requiredKey in obj) : true)) {
        return { obj, start, end: jsonEnd };
      }
    } catch { /* 尝试下一个起始位置 */ }
  }
  return null;
}

// 从完整文本中提取需求提问 JSON：{"question","option","or","dimension"}
export function extractQA(text) {
  const r = extractJsonObject(text, 'question');
  if (!r || r.obj.question == null || String(r.obj.question).trim() === '') return null;
  const obj = r.obj;
  return {
    question: String(obj.question),
    option: Array.isArray(obj.option) ? obj.option.map(String) : [],
    or: obj.or !== undefined ? String(obj.or) : '其他（可自定义输入）',
    dimension: obj.dimension ? String(obj.dimension) : null
  };
}

// 提取需求文档就绪标记（返回 JSON 之前的文档正文）
export function extractDocReady(text) {
  const r = extractJsonObject(text, '__doc_ready');
  if (!r) return null;
  if (r.obj.__doc_ready === true) return text.slice(0, r.start).trim();
  return null;
}

// 解析代码生产协议：FILE_START / FILE_END
function parseCodegen(text) {
  const files = [];

  // ---- 格式 1：[FILE_START: path] ... [FILE_END]（标准协议） ----
  const re1 = /\[FILE_START:\s*([^\]]+)\]([\s\S]*?)\[FILE_END\]/g;
  let m;
  while ((m = re1.exec(text)) !== null) {
    const relPath = m[1].trim();
    let code = m[2];
    code = code.replace(/^```[\w+-]*\s*\n?/, '').replace(/\n?```\s*$/, '');
    files.push({ path: relPath, code: code.trim() });
  }
  if (files.length) return files;

  // ---- 格式 2：markdown 代码块带文件路径（```lang:path 或 ```lang path） ----
  // 匹配 ```lang:path/to/file 或 ```lang path/to/file
  const re2 = /```(\w+)?\s*[:\s]\s*([^\n`]+\.\w+)\s*\n([\s\S]*?)```/g;
  while ((m = re2.exec(text)) !== null) {
    const relPath = m[2].trim().replace(/^["']|["']$/g, '');
    const code = m[3];
    if (relPath && code.trim()) files.push({ path: relPath, code: code.trim() });
  }
  if (files.length) return files;

  // ---- 格式 3：标题/粗体路径 + 紧随的代码块 ----
  // 匹配 ### path/to/file.js 或 **path/to/file.js** 后跟 ```lang ... ```
  const re3 = /(?:^###\s+|^#\s+|\*\*)([^\n*#]+\.\w+)\s*\n+```(\w+)?\s*\n([\s\S]*?)```/gm;
  while ((m = re3.exec(text)) !== null) {
    const relPath = m[1].trim().replace(/\*\*$/, '');
    const code = m[3];
    if (relPath && code.trim()) files.push({ path: relPath, code: code.trim() });
  }

  return files;
}

// 从代码生成响应中剥离 FILE 协议块和代码块，返回纯文本（摘要）
function stripCodegenBlocks(text) {
  return text
    .replace(/\[FILE_START:\s*[^\]]+\][\s\S]*?\[FILE_END\]/g, '')
    .replace(/\[PROJECT_TREE\][\s\S]*?(?=\[FILE_START:|\s*$)/, '')
    .replace(/\[CODEGEN_DONE\]/g, '')
    // 剥离 markdown 代码块（含路径的）
    .replace(/```(\w+)?\s*[:\s]\s*[^\n`]+\.\w+\s*\n[\s\S]*?```/g, '')
    // 剥离标题+代码块组合
    .replace(/(?:^###\s+|^#\s+|\*\*)[^\n*#]+\.\w+\s*\n+```(\w+)?\s*\n[\s\S]*?```/gm, '')
    .trim();
}

// ---------- 上下文构建 ----------

function buildHistory(topicId, limit = 16) {
  const recent = Messages.recent(topicId, limit);
  // 过滤内部标记残留
  return recent.filter(m => {
    if (m.role === 'system') return false;
    if (m.meta?.qa && m.role === 'assistant') return false; // 问答卡片不注入上下文
    return true;
  }).map(m => ({ role: m.role, content: String(m.content).slice(0, 6000) }));
}

class AgentManager {
  constructor() {
    this.configs = {};
    this.reloadConfigs();
  }

  // 重载全部 Agent MD 配置（热更新能力：运行时调用即可生效）
  reloadConfigs() {
    for (const [name, def] of Object.entries(AGENT_DEFS)) {
      const p = path.join(AGENTS_CONFIG_DIR, def.file);
      this.configs[name] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    }
  }

  getAgentsInfo() {
    return Object.entries(AGENT_DEFS).map(([id, def]) => ({
      id,
      name: def.name,
      icon: def.icon,
      desc: def.desc,
      scenario: def.scenario,
      model: deepseek.resolveModel({ scenario: def.scenario }),
      config: this.configs[id] || ''
    }));
  }

  getAgentName(id) {
    return AGENT_DEFS[id]?.name || id;
  }

  // ---------- 路由决策 ----------
  route(topic, text) {
    const stage = topic.stage;
    if (stage === 'clarify') return 'requirement';
    if (stage === 'codegen') {
      // 代码生成阶段：迭代反馈或重新生成 → codegen；其他闲聊 → dialogue
      if (ITERATION_RE.test(text) || CODEGEN_TRIGGER_RE.test(text)) return 'codegen';
      return 'dialogue';
    }
    if (stage === 'docs') {
      // 文档就绪：确认生成 → codegen；其他 → dialogue（可继续讨论）
      return CODEGEN_TRIGGER_RE.test(text) ? 'codegen' : 'dialogue';
    }
    return 'dialogue'; // chat 阶段默认对话
  }

  // ---------- 统一入口 ----------
  async handleMessage(topic, userText, sender) {
    // 1. 持久化用户消息
    Messages.add({ topicId: topic.id, role: 'user', content: userText });

    // 2. 路由
    const target = this.route(topic, userText);
    if (target === 'requirement') {
      await this.runRequirement(topic, userText, sender);
    } else if (target === 'codegen') {
      await this.runCodegen(topic, userText, sender);
    } else {
      await this.runDialogue(topic, userText, sender);
    }
    sender.done();
  }

  // ---------- Agent 1：对话交互 ----------
  async runDialogue(topic, userText, sender) {
    const system = this.buildSystemPrompt('dialogue', topic);
    // 用户消息已在 handleMessage 中持久化，历史中已包含当前消息
    const history = buildHistory(topic.id, 16);
    const messages = [{ role: 'system', content: system }, ...history.slice(-14)];

    const msgId = 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    sender.msgStart(msgId, 'dialogue');
    let content = '';
    try {
      await deepseek.chatStream({
        messages,
        scenario: 'dialog',
        onChunk: d => { content += d; sender.chunk(msgId, d); }
      });
    } catch (e) {
      sender.msgError(msgId, e);
      return;
    }

    // 检测移交需求澄清的标记
    const triggered = /\[TRIGGER_AGENT:requirement\]/.test(content);
    const clean = content.replace(/\[TRIGGER_AGENT:requirement\]/g, '').trim();
    Messages.add({ topicId: topic.id, role: 'assistant', content: clean, agent: 'dialogue' });
    sender.msgEnd(msgId, { content: clean, agent: 'dialogue' });

    if (triggered) {
      // 移交：进入需求澄清阶段，并由需求澄清 Agent 立即发起首问
      Topics.update(topic.id, { stage: 'clarify', agent: 'requirement' });
      sender.topic(Topics.get(topic.id));
      await this.runRequirement(Topics.get(topic.id), '', sender, true);
    }
  }

  // ---------- Agent 2：需求澄清 ----------
  // isFirstQuestion: 从对话 Agent 移交后的自动首问（无需新用户输入）
  async runRequirement(topic, userText, sender, isFirstQuestion = false) {
    // 记录用户对上一问题的回答到需求维度（覆盖式：新回答始终生效，防止模型重复问时丢数据）
    if (!isFirstQuestion && userText) {
      const req = topic.req_state || { dimensions: {}, asked: [], status: 'clarifying' };
      const last = req.asked[req.asked.length - 1];
      // 无论有无维度记录都保存回答；无历史提问时归入「一般」维度
      const dim = last?.dimension || '一般';
      req.dimensions[dim] = String(userText).slice(0, 500);
      if (!last) {
        req.asked.push({ dimension: dim, question: '(用户直接补充需求信息)', at: Date.now() });
      }
      topic.req_state = req;
      Topics.update(topic.id, { req_state: req });
    }
    const system = this.buildSystemPrompt('requirement', topic);
    const history = buildHistory(topic.id, 12);
    let messages = [{ role: 'system', content: system }, ...history.slice(-10)];
    if (isFirstQuestion) {
      messages.push({ role: 'user', content: '（自动）请开始需求澄清流程，根据已有信息提出第一个需要确认的问题。' });
    }

    const msgId = 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    sender.msgStart(msgId, 'requirement');
    let content = '';
    try {
      await deepseek.chatStream({
        messages,
        scenario: 'reasoning',
        temperature: 0.4,
        onChunk: d => { content += d; sender.chunk(msgId, d); }
      });
    } catch (e) {
      sender.msgError(msgId, e);
      return;
    }

    // 1) 需求文档就绪？
    const docText = extractDocReady(content);
    if (docText) {
      const clean = docText.trim();
      Messages.add({ topicId: topic.id, role: 'assistant', content: clean, agent: 'requirement',
        meta: { docReady: true } });
      sender.msgEnd(msgId, { content: clean, agent: 'requirement', meta: { docReady: true } });

      // 生成需求文档 + 创建 project + workfolder
      await this.finalizeRequirementDoc(topic, clean);
      sender.topic(Topics.get(topic.id));
      return;
    }

    // 2) 二次问答结构字段？
    const qa = extractQA(content);
    let cleanContent = content.trim();
    if (qa) {
      const r = extractJsonObject(content, 'question');
      if (r) cleanContent = content.slice(0, r.start).trim();
    }
    if (qa) {
      // 记录本次提问维度（dimension 缺失时兜底「一般」，保证 asked 与回答始终可追踪）
      const req = topic.req_state || { dimensions: {}, asked: [], status: 'clarifying' };
      const dim = qa.dimension || '一般';
      if (!req.asked.some(a => a.dimension === dim && a.question === qa.question)) {
        req.asked.push({ dimension: dim, question: qa.question, at: Date.now() });
      }
      // 格式已恢复正常，清除自愈标记
      if (req.lastFormatError) req.lastFormatError = false;
      Topics.update(topic.id, { req_state: req });
      Messages.add({ topicId: topic.id, role: 'assistant', content: cleanContent || qa.question, agent: 'requirement',
        meta: { qa } });
      sender.msgEnd(msgId, { content: cleanContent || qa.question, agent: 'requirement', meta: { qa } });
      sender.topic(Topics.get(topic.id));
      return;
    }

    // 3) 普通说明性回复
    Messages.add({ topicId: topic.id, role: 'assistant', content, agent: 'requirement' });
    // 格式损坏自愈：内容疑似应输出结构化 JSON（含 question 字样或未闭合代码围栏），
    // 但解析失败 → 打标记，下一轮注入提示要求模型严格按规范输出
    const fences = (content.match(/```/g) || []).length;
    if (/question/i.test(content) || fences % 2 === 1) {
      const req = topic.req_state || { dimensions: {}, asked: [], status: 'clarifying' };
      req.lastFormatError = true;
      Topics.update(topic.id, { req_state: req });
    }
    sender.msgEnd(msgId, { content, agent: 'requirement' });
    sender.topic(Topics.get(topic.id));
  }

  // 需求梳理完成：保存文档、创建 project + workfolder
  async finalizeRequirementDoc(topic, docText) {
    // 提取项目名称：优先「项目名称：」字段，其次文档 H1，最后主题标题
    const nameMatch = docText.match(/[-\*]?\s*项目名称[：:]\s*(.+)/);
    const titleMatch = docText.match(/^#\s+(.+)$/m);
    const projectName = (nameMatch ? nameMatch[1] : (titleMatch ? titleMatch[1] : null) || topic.title || '未命名项目').trim();

    // 已有 project 则复用 workfolder，否则创建
    let project = Projects.getByTopic(topic.id);
    let dirName;
    if (project) {
      dirName = project.folder;
    } else {
      const wfRes = wf.createWorkfolder(topic.id, projectName);
      dirName = wfRes.dirName;
      project = Projects.create({ topicId: topic.id, folder: dirName });
    }
    const reqDocRel = wf.writeRequirementDoc(dirName, docText);
    wf.appendLog(dirName, `需求文档已生成：${reqDocRel}`);
    Projects.update(topic.id, { req_doc: reqDocRel, status: 'planning' });

    // 记录已收集维度（从文档结构推断）
    const req = topic.req_state || { dimensions: {}, asked: [], status: 'ready' };
    req.status = 'ready';
    Topics.update(topic.id, {
      stage: 'docs',
      agent: 'codegen',
      kind: 'project',
      title: projectName,
      req_state: req
    });
    return { projectName, dirName };
  }

  // ---------- Agent 3：代码生产 ----------
  async runCodegen(topic, userText, sender) {
    const system = this.buildSystemPrompt('codegen', topic);
    const history = buildHistory(topic.id, 8);
    const messages = [{ role: 'system', content: system }, ...history.slice(-6)];

    const msgId = 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    sender.msgStart(msgId, 'codegen');
    let content = '';
    try {
      await deepseek.chatStream({
        messages,
        scenario: 'reasoning',
        temperature: 0.3,
        maxTokens: 8192,
        onChunk: d => { content += d; sender.chunk(msgId, d); }
      });
    } catch (e) {
      sender.msgError(msgId, e);
      return;
    }

    const files = parseCodegen(content);
    const project = Projects.getByTopic(topic.id);
    let dirName = project?.folder;

    // 首次生成：若尚无 workfolder 则创建
    if (!dirName) {
      const wfRes = wf.createWorkfolder(topic.id, topic.title || 'project');
      dirName = wfRes.dirName;
      if (!project) Projects.create({ topicId: topic.id, folder: dirName });
      else Projects.update(topic.id, { folder: dirName });
    }

    // 确定写入目录：自定义路径优先，否则用默认 workfolder
    const customPath = project?.workfolder_path;
    const writeTarget = customPath || dirName;
    if (customPath) wf.ensureCustomDir(customPath);

    const written = [];
    for (const f of files) {
      try {
        wf.writeFile(writeTarget, f.path, f.code);
        written.push(f.path);
        wf.appendLog(writeTarget, `生成文件：${f.path}（${f.code.length} 字符）`);
      } catch (e) {
        wf.appendLog(writeTarget, `写入失败 ${f.path}: ${e.message}`);
      }
    }

    const done = /\[CODEGEN_DONE\]/.test(content);
    const summary = stripCodegenBlocks(content);

    // 构造展示内容
    let display;
    if (written.length > 0) {
      const list = written.map(p => `- \`${p}\``).join('\n');
      display = [
        summary || (done ? '✅ 项目代码生成完成！' : '项目代码已生成。'),
        '',
        `共生成 **${written.length}** 个文件：`,
        '',
        list,
        '',
        customPath
          ? `📦 文件已写入自定义目录：\`${customPath}\``
          : '📦 文件已写入独立 workfolder，可在右侧「项目文件」面板查看与浏览。',
        done ? '' : '⚠️ 生成未完全完成，可继续补充指令。'
      ].filter(Boolean).join('\n');
    } else {
      // 0 文件诊断：区分空响应 vs 格式不匹配
      if (!content || !content.trim()) {
        display = [
          '⚠️ **模型返回了空响应**，代码生成未产出任何内容。',
          '',
          '可能原因：',
          '- 模型上下文过长导致输出被截断',
          '- API 限流或临时故障',
          '',
          '建议：重新发送「开始生成代码」重试。如多次失败，可尝试在设置中切换模型。'
        ].join('\n');
      } else {
        // 有内容但未解析出文件 → 显示原始内容并提示格式问题
        display = [
          summary || content.slice(0, 2000),
          '',
          '---',
          '⚠️ **未能从模型输出中解析出代码文件**。',
          '',
          '模型可能未按照 `[FILE_START: 路径]...[FILE_END]` 协议输出。',
          '请重新发送「开始生成代码」，系统会提示模型严格按协议格式输出。'
        ].join('\n');
      }
    }

    if (project) {
      Projects.update(topic.id, {
        status: done ? 'generated' : 'iterating',
        req_doc: project.req_doc
      });
    }
    wf.appendLog(writeTarget, `代码生成：${written.length} 个文件，done=${done}` + (!content?.trim() ? '，空响应' : ''));

    // 阶段流转：进入代码生产阶段，后续反馈由代码生产 Agent 承接迭代
    // 格式自愈标记：0 文件时打标记，下一轮注入格式提醒
    const req = topic.req_state || {};
    req.lastCodegenEmpty = (written.length === 0);
    Topics.update(topic.id, { stage: 'codegen', agent: 'codegen', req_state: req });

    Messages.add({
      topicId: topic.id, role: 'assistant', content: display, agent: 'codegen',
      meta: { codegen: { files: written, done } }
    });
    sender.msgEnd(msgId, { content: display, agent: 'codegen', meta: { codegen: { files: written, done } } });
    sender.topic(Topics.get(topic.id));
  }

  // ---------- 系统提示词构建（MD 配置 + 实时状态注入） ----------
  buildSystemPrompt(agent, topic) {
    const base = this.configs[agent] || '';
    const state = [];

    state.push('## 当前会话状态');
    state.push(`- 对话主题：${topic.title || '未命名'}`);
    state.push(`- 当前阶段：${STAGE_DESC[topic.stage] || topic.stage}`);

    // 需求澄清状态注入
    if (topic.req_state && Object.keys(topic.req_state.dimensions || {}).length) {
      state.push('');
      state.push('### 已收集的需求信息（来自用户的历轮回答）');
      for (const [k, v] of Object.entries(topic.req_state.dimensions)) {
        state.push(`- ${k}：${String(v).slice(0, 300)}`);
      }
    }
    if (topic.req_state?.asked?.length) {
      state.push('');
      state.push('### 已提问过的问题（避免重复提问）');
      for (const q of topic.req_state.asked) {
        state.push(`- [${q.dimension || '一般'}] ${String(q.question).slice(0, 120)}`);
      }
    }
    if (topic.req_state?.lastFormatError) {
      state.push('');
      state.push('### ⚠️ 格式修复提示（必须遵守）');
      state.push('上一轮你的结构化输出未被系统解析（JSON 不完整或格式不规范）。本轮必须严格按「输出规范」输出：');
      state.push('1. JSON 必须完整闭合、严格合法；');
      state.push('2. JSON 独占一行，不要用 markdown 代码围栏（```）包裹；');
      state.push('3. JSON 之后不要再输出任何文字；');
      state.push('4. dimension 字段必填，取自规定的 8 个需求维度名之一。');
    }

    // 需求文档内容注入（codegen 必须依据）
    const project = Projects.getByTopic(topic.id);
    if (project?.folder) {
      // 确定读取目录：自定义路径优先
      const readTarget = project.workfolder_path || project.folder;
      const doc = project.req_doc ? wf.readFile(readTarget, project.req_doc) : null;
      if (doc) {
        state.push('');
        state.push('## 需求架构文档（代码生成唯一依据）');
        state.push(doc.slice(0, 12000));
      }
      // workfolder 现有文件（供迭代修改）
      const files = wf.listFiles(readTarget);
      if (files.length) {
        state.push('');
        state.push('### workfolder 现有文件清单');
        state.push(files.map(f => `- ${f.path}`).join('\n'));
        // 注入关键文件内容用于迭代
        const codeFiles = files.filter(f => /\.(js|ts|jsx|tsx|html|css|py|json|vue|java|go|rs|md)$/.test(f.path) && !f.path.includes('docs/') && f.path !== 'README.md' && f.path !== 'logs/').slice(0, 5);
        for (const f of codeFiles) {
          const c = wf.readFile(readTarget, f.path);
          if (c && c.length < 8000) {
            state.push('');
            state.push(`### 文件：${f.path}`);
            state.push('```');
            state.push(c.slice(0, 8000));
            state.push('```');
          }
        }
      }
      // codegen 格式自愈：上次生成 0 文件时注入格式提醒
      if (agent === 'codegen' && topic.req_state?.lastCodegenEmpty) {
        state.push('');
        state.push('### ⚠️ 代码生成格式提醒（必须遵守）');
        state.push('上一轮代码生成未解析出任何文件。你必须严格使用以下协议输出代码：');
        state.push('1. 每个文件用 `[FILE_START: 相对路径]` 开头，`[FILE_END]` 结尾；');
        state.push('2. 文件路径为相对 workfolder 根目录的路径（如 `src/index.js`、`package.json`）；');
        state.push('3. 示例格式：');
        state.push('   [FILE_START: src/index.js]');
        state.push('   ```js');
        state.push('   console.log("hello");');
        state.push('   ```');
        state.push('   [FILE_END]');
        state.push('4. 所有文件输出完毕后，最后一行输出 `[CODEGEN_DONE]`；');
        state.push('5. 不要省略代码内容，每个文件必须输出完整可运行的代码。');
      }
    }

    return `${base}\n\n${state.join('\n')}`;
  }
}

export const agentManager = new AgentManager();
export { AGENT_DEFS };
