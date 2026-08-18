```js
const clarifyingAgent = require('./clarifyingAgent');
const codegenAgent = require('./codegenAgent');
const { callLLM } = require('../utils/llm');
const db = require('../db');

/**
 * 主控 Agent：解析用户意图并调度对应 Agent
 * @param {string} conversationId
 * @param {string} userMessage
 * @returns {Promise<{content: string, agent: string}>}
 */
async function handleMessage(conversationId, userMessage) {
  const conversation = db.prepare('SELECT meta FROM conversations WHERE id = ?').get(conversationId);
  const meta = JSON.parse(conversation.meta || '{}');

  // 1. 澄清进行中，继续提问
  if (meta.clarifying && !meta.clarifyingDone) {
    return clarifyingAgent.continueClarification(conversationId, userMessage, meta);
  }

  // 2. 澄清已完成，检测是否触发代码生成
  if (meta.clarifyingDone) {
    const codegenKeywords = ['生成', '开始', '继续', '实现', '代码', '开发', '写'];
    if (codegenKeywords.some(k => userMessage.includes(k))) {
      return codegenAgent.generateCode(conversationId, meta);
    }
    // 未触发代码生成，按普通对话处理，提示用户可开始生成
    return {
      content: '需求文档已生成，你可以发送「开始生成代码」让我在 workfolder 中生成项目代码。',
      agent: '主控 Agent'
    };
  }

  // 3. 检测是否需要启动澄清流程
  const needClarifyKeywords = ['需求', '生成', '代码', '实现', '开发', '做个', '创建一个'];
  if (needClarifyKeywords.some(k => userMessage.includes(k))) {
    return clarifyingAgent.startClarification(conversationId, meta);
  }

  // 4. 普通对话，直接调用 LLM
  try {
    const reply = await callLLM([
      { role: 'system', content: '你是主控 Agent，负责回答用户的问题。请用中文简洁回复。' },
      { role: 'user', content: userMessage }
    ]);
    return { content: reply, agent: '主控 Agent' };
  } catch (error) {
    return { content: `智能回复失败：${error.message}`, agent: '主控 Agent' };
  }
}

module.exports = { handleMessage };