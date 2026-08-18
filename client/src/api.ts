// ============ API 客户端（REST + SSE 流式） ============

const BASE = '/api';

export class ApiError extends Error {
  code: string;
  constructor(message: string, code = 'ERROR') {
    super(message);
    this.code = code;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json().catch(() => ({ code: -1, message: '响应解析失败', data: null }));
  if (!res.ok || body.code !== 0) {
    throw new ApiError(body.message || `请求失败 (${res.status})`, body.code);
  }
  return body.data as T;
}

const json = (data: any) => JSON.stringify(data);

// ---------- Topics ----------
export const topicsApi = {
  list: () => request<any[]>('/topics'),
  get: (id: string) => request<any>(`/topics/${id}`),
  create: (title?: string, kind = 'chat') => request<any>('/topics', { method: 'POST', body: json({ title, kind }) }),
  rename: (id: string, title: string) => request<any>(`/topics/${id}`, { method: 'PATCH', body: json({ title }) }),
  remove: (id: string) => request<any>(`/topics/${id}`, { method: 'DELETE' }),
  clear: (id: string) => request<any>(`/topics/${id}/clear`, { method: 'POST' }),
  messages: (id: string) => request<any[]>(`/topics/${id}/messages`)
};

// ---------- Settings ----------
export const settingsApi = {
  get: () => request<any>('/settings'),
  addToken: (name: string, token: string) => request<any>('/settings/deepseek/tokens', { method: 'POST', body: json({ name, token }) }),
  updateToken: (id: string, patch: any) => request<any>(`/settings/deepseek/tokens/${id}`, { method: 'PATCH', body: json(patch) }),
  deleteToken: (id: string) => request<any>(`/settings/deepseek/tokens/${id}`, { method: 'DELETE' }),
  setScenarioModel: (scenario: string, model: string) => request<any>('/settings/deepseek/scenario-model', { method: 'PUT', body: json({ scenario, model }) }),
  reloadAgents: () => request<any>('/settings/agents/reload', { method: 'POST' })
};

// ---------- Projects ----------
export const projectsApi = {
  get: (topicId: string) => request<any>(`/projects/topic/${topicId}`),
  file: (topicId: string, path: string) => request<any>(`/projects/topic/${topicId}/file?path=${encodeURIComponent(path)}`),
  requirement: (topicId: string) => request<any>(`/projects/topic/${topicId}/requirement`),
  setWorkfolder: (topicId: string, workfolderPath: string) =>
    request<any>(`/projects/topic/${topicId}/workfolder`, { method: 'PUT', body: json({ workfolderPath }) })
};

// ---------- SSE 流式对话 ----------
export interface SSEHandlers {
  onMsgStart?: (data: { id: string; agent: string }) => void;
  onChunk?: (data: { id: string; delta: string }) => void;
  onMsgEnd?: (data: { id: string; content: string; agent: string; meta: any }) => void;
  onError?: (data: { id: string; code: string; message: string }) => void;
  onTopic?: (data: { topic: any }) => void;
  onDone?: () => void;
}

export async function postChatSSE(url: string, body: any, handlers: SSEHandlers): Promise<void> {
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json(body)
  });
  if (!res.ok || !res.body) {
    let message = `请求失败 (${res.status})`;
    try {
      const j = await res.json();
      message = j.message || message;
    } catch { /* ignore */ }
    handlers.onError?.({ id: 'server', code: 'HTTP_ERROR', message });
    handlers.onDone?.();
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE 事件以空行分隔
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handleBlock(block, handlers);
    }
  }
  // 尾部残留
  if (buffer.trim()) handleBlock(buffer, handlers);
  handlers.onDone?.();
}

function handleBlock(block: string, handlers: SSEHandlers) {
  let event = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    const l = line.replace(/\r$/, '');
    if (l.startsWith('event:')) event = l.slice(6).trim();
    else if (l.startsWith('data:')) data = l.slice(5).trim();
  }
  if (!data || data.startsWith('{') === false) return;
  try {
    const parsed = JSON.parse(data);
    switch (event) {
      case 'msg_start': handlers.onMsgStart?.(parsed); break;
      case 'chunk': handlers.onChunk?.(parsed); break;
      case 'msg_end': handlers.onMsgEnd?.(parsed); break;
      case 'error': handlers.onError?.(parsed); break;
      case 'topic': handlers.onTopic?.(parsed); break;
      case 'done': handlers.onDone?.(); break;
    }
  } catch { /* ignore malformed */ }
}
