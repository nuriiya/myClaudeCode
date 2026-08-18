import { Settings } from '../db.js';
import { DEEPSEEK_API_BASE, MODELS, SCENARIO_MODELS, MODEL_TIMEOUT } from '../config.js';

// ============================================================
// DeepSeek 双模型服务
// - 支持多 Token 配置、启用/禁用、滚动切换
// - 支持场景化默认模型（flash 高速 / pro 深度）
// - 统一异常处理：Token失效 / 额度不足 / 超时 / 请求失败
// ============================================================

const DEFAULT_SETTINGS = {
  tokens: [],            // [{id, name, token, enabled, created_at}]
  scenarioModels: { ...SCENARIO_MODELS }
};

function getConfig() {
  const cfg = Settings.getJson('deepseek', null) || { ...DEFAULT_SETTINGS };
  if (!cfg.scenarioModels) cfg.scenarioModels = { ...SCENARIO_MODELS };
  if (!cfg.tokens) cfg.tokens = [];
  return cfg;
}

export function saveConfig(cfg) {
  const merged = { ...getConfig(), ...cfg };
  Settings.set('deepseek', merged);
  return merged;
}

// ---------- Token 管理 ----------
export function listTokens() {
  const cfg = getConfig();
  // 脱敏返回
  return cfg.tokens.map(t => ({ ...t, token: maskToken(t.token) }));
}

export function addToken({ name = '默认Key', token }) {
  if (!token || !token.trim()) throw new Error('Token 不能为空');
  const cfg = getConfig();
  cfg.tokens.push({
    id: 'tk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim() || '默认Key',
    token: token.trim(),
    enabled: true,
    created_at: Date.now()
  });
  saveConfig(cfg);
  return listTokens();
}

export function updateToken(id, patch) {
  const cfg = getConfig();
  const idx = cfg.tokens.findIndex(t => t.id === id);
  if (idx === -1) throw new Error('Token 不存在');
  cfg.tokens[idx] = { ...cfg.tokens[idx], ...patch };
  saveConfig(cfg);
  return listTokens();
}

export function deleteToken(id) {
  const cfg = getConfig();
  cfg.tokens = cfg.tokens.filter(t => t.id !== id);
  saveConfig(cfg);
  return listTokens();
}

// ---------- 模型配置 ----------
export function getModelConfig() {
  const cfg = getConfig();
  return {
    scenarioModels: cfg.scenarioModels,
    models: Object.values(MODELS).map(m => ({ ...m }))
  };
}

export function setScenarioModel(scenario, modelId) {
  const valid = Object.values(MODELS).some(m => m.id === modelId);
  if (!valid) throw new Error(`未知模型: ${modelId}`);
  const cfg = getConfig();
  cfg.scenarioModels[scenario] = modelId;
  saveConfig(cfg);
  return getModelConfig();
}

// 获取指定场景的模型（支持显式指定或按场景默认）
export function resolveModel({ scenario = 'dialog', model = null } = {}) {
  const cfg = getConfig();
  if (model) return model;
  return cfg.scenarioModels[scenario] || SCENARIO_MODELS[scenario] || MODELS.flash.id;
}

function maskToken(t) {
  if (!t) return '';
  if (t.length <= 8) return '****';
  return t.slice(0, 6) + '****' + t.slice(-4);
}

// 获取可用 Token（轮询启用中的 Token，实现负载分摊）
function pickToken() {
  const cfg = getConfig();
  const enabled = cfg.tokens.filter(t => t.enabled && t.token);
  if (enabled.length === 0) {
    const err = new Error('未配置可用的 DeepSeek Token，请在「设置」中配置');
    err.code = 'NO_TOKEN';
    throw err;
  }
  return enabled[Math.floor(Math.random() * enabled.length)];
}

// ---------- 错误标准化 ----------
export function normalizeApiError(e) {
  const out = { code: 'MODEL_ERROR', message: '模型调用失败', detail: null };
  const status = e?.status || e?.response?.status;
  if (status === 401) {
    out.code = 'TOKEN_INVALID'; out.message = 'Token 无效或已失效，请检查 DeepSeek Token 配置';
  } else if (status === 402 || status === 429) {
    out.code = 'QUOTA_EXCEEDED'; out.message = '模型调用额度不足或触发限流，请稍后重试或更换 Token';
  } else if (status === 400) {
    out.code = 'BAD_REQUEST'; out.message = '请求参数错误：' + (e?.body?.error?.message || '');
  } else if (status === 5) {
    out.code = 'SERVER_ERROR'; out.message = 'DeepSeek 服务异常，请稍后重试';
  } else if (e?.name === 'AbortError' || e?.code === 'TIMEOUT') {
    out.code = 'TIMEOUT'; out.message = '模型响应超时，请重试或切换为 Flash 模型';
  } else if (e?.code === 'NO_TOKEN') {
    out.code = 'NO_TOKEN'; out.message = e.message;
  } else if (e?.code === 'FETCH_FAILED' || e?.type === 'system') {
    out.code = 'NETWORK_ERROR'; out.message = '网络连接失败，无法访问 DeepSeek API';
  } else {
    out.message = e?.message || out.message;
    out.detail = String(e?.body || e?.detail || '');
  }
  return out;
}

function buildError(e) {
  const n = normalizeApiError(e);
  const err = new Error(n.message);
  err.code = n.code;
  err.detail = n.detail;
  return err;
}

// ---------- 非流式调用 ----------
export async function chat({ messages, model = null, scenario = 'dialog', temperature = 0.7, maxTokens = 4096 }) {
  const modelId = resolveModel({ scenario, model });
  const token = pickToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT);
  try {
    const res = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.token}`
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      }),
      signal: controller.signal
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(body?.error?.message || `HTTP ${res.status}`);
      e.status = res.status;
      e.body = body;
      throw buildError(e);
    }
    return {
      content: body?.choices?.[0]?.message?.content || '',
      usage: body?.usage || null,
      model: modelId
    };
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('模型响应超时');
      err.code = 'TIMEOUT';
      throw err;
    }
    if (e.code) throw e;
    const err = new Error('网络连接失败');
    err.code = 'FETCH_FAILED';
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 流式调用（SSE） ----------
// onChunk(content): 增量文本回调
// 返回完整内容
export async function chatStream({ messages, model = null, scenario = 'dialog', temperature = 0.7, maxTokens = 8192, onChunk }) {
  const modelId = resolveModel({ scenario, model });
  const token = pickToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT);
  try {
    const res = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.token}`
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const e = new Error(body?.error?.message || `HTTP ${res.status}`);
      e.status = res.status;
      e.body = body;
      throw buildError(e);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // 按行解析 SSE
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') { buffer = ''; break; }
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content || '';
          if (delta) {
            full += delta;
            if (onChunk) onChunk(delta);
          }
        } catch { /* 忽略解析失败的数据帧 */ }
      }
    }
    return { content: full, model: modelId };
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('模型响应超时');
      err.code = 'TIMEOUT';
      throw err;
    }
    if (e.code) throw e;
    const err = new Error('网络连接失败');
    err.code = 'FETCH_FAILED';
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export { MODELS, SCENARIO_MODELS };
