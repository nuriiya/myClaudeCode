```js
const axios = require('axios');

/**
 * 调用 Deepseek LLM
 * @param {Array} messages - 消息数组 [{role, content}]
 * @param {Object} options - 可选参数 {temperature, maxTokens, apiBase, model}
 * @returns {Promise<string>} 模型回复文本
 */
async function callLLM(messages, options = {}) {
  const token = process.env.DEEPSEEK_TOKEN;
  if (!token) {
    throw new Error('DEEPSEEK_TOKEN 未设置，请在设置页配置或设置环境变量');
  }

  const apiBase = options.apiBase || process.env.LLM_API_BASE || 'https://api.deepseek.com';
  const model = options.model || process.env.LLM_MODEL || 'deepseek-chat';
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 2048;

  const response = await axios.post(
    `${apiBase}/chat/completions`,
    {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    }
  );

  return response.data.choices[0].message.content.trim();
}

module.exports = { callLLM };