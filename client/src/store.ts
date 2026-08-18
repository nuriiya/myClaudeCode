import { create } from 'zustand';
import {
  topicsApi, settingsApi, projectsApi, postChatSSE
} from './api';
import type { ChatMessage, Topic, SettingsData, ProjectMeta, QAPayload } from './types';

interface PendingQA {
  messageId: string;
  qa: QAPayload;
  answer: string;
  selectedOption: string | null;
}

interface AppState {
  // 主题
  topics: Topic[];
  activeTopicId: string | null;
  messages: ChatMessage[];
  loadingTopics: boolean;
  loadingMessages: boolean;

  // 设置
  settings: SettingsData | null;
  settingsOpen: boolean;

  // 项目面板
  projectPanelOpen: boolean;
  projectMeta: ProjectMeta | null;

  // 对话状态
  sending: boolean;
  pendingQA: PendingQA | null;

  // 主题操作
  loadTopics: () => Promise<void>;
  createTopic: (title?: string) => Promise<Topic | null>;
  renameTopic: (id: string, title: string) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  clearTopic: (id: string) => Promise<void>;
  selectTopic: (id: string) => Promise<void>;

  // 对话
  loadMessages: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  submitQA: (content: string) => Promise<void>;
  setPendingQAAnswer: (text: string) => void;
  selectQaOption: (opt: string) => void;
  clearPendingQA: () => void;

  // 设置操作
  openSettings: () => void;
  closeSettings: () => void;
  loadSettings: () => Promise<void>;
  addToken: (name: string, token: string) => Promise<void>;
  updateToken: (id: string, patch: any) => Promise<void>;
  deleteToken: (id: string) => Promise<void>;
  setScenarioModel: (scenario: string, model: string) => Promise<void>;

  // 项目面板
  openProjectPanel: () => void;
  closeProjectPanel: () => void;
  loadProjectMeta: () => Promise<void>;
  setWorkfolder: (path: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  topics: [],
  activeTopicId: null,
  messages: [],
  loadingTopics: false,
  loadingMessages: false,
  settings: null,
  settingsOpen: false,
  projectPanelOpen: false,
  projectMeta: null,
  sending: false,
  pendingQA: null,

  // ============ 主题操作 ============
  loadTopics: async () => {
    set({ loadingTopics: true });
    try {
      const topics = await topicsApi.list();
      set({ topics, loadingTopics: false });
      if (!get().activeTopicId && topics.length > 0) {
        await get().selectTopic(topics[0].id);
      }
    } catch (e: any) {
      set({ loadingTopics: false });
      console.error('加载主题失败', e);
    }
  },

  createTopic: async (title) => {
    try {
      const topic = await topicsApi.create(title);
      const topics = await topicsApi.list();
      set({ topics });
      await get().selectTopic(topic.id);
      return topic;
    } catch (e: any) {
      console.error('创建主题失败', e);
      alert(e.message || '创建失败');
      return null;
    }
  },

  renameTopic: async (id, title) => {
    await topicsApi.rename(id, title);
    await get().loadTopics();
  },

  deleteTopic: async (id) => {
    if (!window.confirm('确定删除该对话主题？将同步删除其对话记录、需求文档与项目代码数据。')) return;
    try {
      await topicsApi.remove(id);
      const topics = await topicsApi.list();
      set({ topics });
      if (get().activeTopicId === id) {
        if (topics.length > 0) await get().selectTopic(topics[0].id);
        else {
          set({ activeTopicId: null, messages: [], projectMeta: null, projectPanelOpen: false });
        }
      }
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  },

  clearTopic: async (id) => {
    if (!window.confirm('确定清空该主题的全部对话记录？')) return;
    await topicsApi.clear(id);
    set({ messages: [] });
    await get().loadTopics();
  },

  selectTopic: async (id) => {
    set({ activeTopicId: id, messages: [], pendingQA: null, projectMeta: null, projectPanelOpen: false });
    await get().loadMessages();
  },

  // ============ 对话 ============
  loadMessages: async () => {
    const { activeTopicId } = get();
    if (!activeTopicId) return;
    set({ loadingMessages: true });
    try {
      const msgs = await topicsApi.messages(activeTopicId);
      set({ messages: msgs.map(m => ({ ...m, streaming: false, error: null })), loadingMessages: false });
    } catch (e) {
      set({ loadingMessages: false });
    }
  },

  sendMessage: async (content) => {
    const { activeTopicId, sending } = get();
    if (!activeTopicId || sending || !content.trim()) return;
    const text = content.trim();

    // 追加用户消息
    const userMsg: ChatMessage = {
      id: 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      topicId: activeTopicId,
      role: 'user',
      content: text,
      meta: null,
      createdAt: Date.now()
    };
    set(state => ({ messages: [...state.messages, userMsg], sending: true }));

    // 占位 AI 消息（流式填充）
    const aiId = 'stream_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const aiMsg: ChatMessage = {
      id: aiId,
      topicId: activeTopicId,
      role: 'assistant',
      content: '',
      meta: null,
      agent: null,
      createdAt: Date.now(),
      streaming: true
    };
    set(state => ({ messages: [...state.messages, aiMsg] }));

    try {
      await postChatSSE('/chat', { topicId: activeTopicId, content: text }, {
        onMsgStart: ({ id, agent }) => {
          // 服务器生成的消息 ID 可能与占位符不同（多消息移交场景），
          // 此时移除占位符、按服务器消息为准
          set(state => {
            if (id !== aiId) {
              const exists = state.messages.some(m => m.id === id);
              if (exists) return state;
              return {
                ...state,
                messages: [
                  ...state.messages.filter(m => m.id !== aiId),
                  { id, topicId: activeTopicId, role: 'assistant', content: '', meta: null, agent,
                    createdAt: Date.now(), streaming: true }
                ]
              };
            }
            return {
              messages: state.messages.map(m => m.id === aiId ? { ...m, agent, streaming: true } : m)
            };
          });
        },
        onChunk: ({ id, delta }) => {
          set(state => ({
            messages: state.messages.map(m => m.id === id ? { ...m, content: m.content + delta } : m)
          }));
        },
        onMsgEnd: ({ id, content, meta, agent }) => {
          set(state => ({
            messages: state.messages.map(m => m.id === id ? {
              ...m, content, meta, agent, streaming: false, error: null
            } : m)
          }));
        },
        onError: ({ id, code, message }) => {
          set(state => ({
            messages: state.messages.map(m => m.id === id ? {
              ...m, streaming: false, error: { code, message }
            } : m)
          }));
        },
        onTopic: ({ topic }) => {
          // 同步主题状态（阶段流转）
          set(state => ({
            topics: state.topics.map(t => t.id === topic.id ? { ...t, ...topic } : t)
          }));
          if (topic.id === get().activeTopicId && topic.stage === 'docs') {
            get().loadProjectMeta();
          }
        },
        onDone: () => {
          set({ sending: false });
          get().loadTopics();
          // 只检查本次流式产生的最后一条 assistant 消息（排除错误/未完成），
          // 避免模型本次未返回新提问时回退弹出历史旧问题（导致"回答了没解锁、重复提问"）
          const msgs = get().messages;
          const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant' && !m.error && !m.streaming);
          if (lastAssistant?.meta?.qa) {
            set({
              pendingQA: { messageId: lastAssistant.id, qa: lastAssistant.meta.qa, answer: '', selectedOption: null }
            });
          }
          // 更新项目元数据
          if (get().activeTopicId) get().loadProjectMeta();
        }
      });
    } catch (e: any) {
      set(state => ({
        sending: false,
        messages: state.messages.map(m => m.id === aiId ? {
          ...m, streaming: false, error: { code: 'NETWORK', message: e.message || '网络错误' }
        } : m)
      }));
    }
  },

  submitQA: async (content) => {
    const { activeTopicId, pendingQA, sending } = get();
    if (!activeTopicId || !pendingQA || sending || !content.trim()) return;
    const text = content.trim();

    // 追加用户回答
    const userMsg: ChatMessage = {
      id: 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      topicId: activeTopicId,
      role: 'user',
      content: text,
      meta: { fromQA: true, originalQuestion: pendingQA.qa.question },
      createdAt: Date.now()
    };
    set(state => ({ messages: [...state.messages, userMsg], sending: true, pendingQA: null }));

    const aiId = 'stream_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const aiMsg: ChatMessage = {
      id: aiId, topicId: activeTopicId, role: 'assistant', content: '', meta: null, agent: null,
      createdAt: Date.now(), streaming: true
    };
    set(state => ({ messages: [...state.messages, aiMsg] }));

    try {
      await postChatSSE('/chat/answer', {
        topicId: activeTopicId,
        answer: text,
        originalQuestion: pendingQA.qa.question
      }, {
        onMsgStart: ({ id, agent }) => {
          set(state => {
            if (id !== aiId) {
              const exists = state.messages.some(m => m.id === id);
              if (exists) return state;
              return {
                ...state,
                messages: [
                  ...state.messages.filter(m => m.id !== aiId),
                  { id, topicId: activeTopicId, role: 'assistant', content: '', meta: null, agent,
                    createdAt: Date.now(), streaming: true }
                ]
              };
            }
            return {
              messages: state.messages.map(m => m.id === aiId ? { ...m, agent, streaming: true } : m)
            };
          });
        },
        onChunk: ({ id, delta }) => {
          set(state => ({
            messages: state.messages.map(m => m.id === id ? { ...m, content: m.content + delta } : m)
          }));
        },
        onMsgEnd: ({ id, content, meta, agent }) => {
          set(state => ({
            messages: state.messages.map(m => m.id === id ? { ...m, content, meta, agent, streaming: false, error: null } : m)
          }));
        },
        onError: ({ id, code, message }) => {
          set(state => ({
            messages: state.messages.map(m => m.id === id ? { ...m, streaming: false, error: { code, message } } : m)
          }));
        },
        onTopic: ({ topic }) => {
          set(state => ({ topics: state.topics.map(t => t.id === topic.id ? { ...t, ...topic } : t) }));
        },
        onDone: () => {
          set({ sending: false });
          get().loadTopics();
          // 只检查最后一条 assistant 消息（排除错误/未完成），不回退查找历史旧 QA
          const msgs = get().messages;
          const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant' && !m.error && !m.streaming);
          if (lastAssistant?.meta?.qa) {
            set({ pendingQA: { messageId: lastAssistant.id, qa: lastAssistant.meta.qa, answer: '', selectedOption: null } });
          }
          if (get().activeTopicId) get().loadProjectMeta();
        }
      });
    } catch (e: any) {
      set(state => ({
        sending: false,
        messages: state.messages.map(m => m.id === aiId ? { ...m, streaming: false, error: { code: 'NETWORK', message: e.message || '网络错误' } } : m)
      }));
    }
  },

  setPendingQAAnswer: (text) => {
    set(state => ({ pendingQA: state.pendingQA ? { ...state.pendingQA, answer: text } : null }));
  },
  selectQaOption: (opt) => {
    set(state => ({
      pendingQA: state.pendingQA ? { ...state.pendingQA, selectedOption: opt, answer: opt } : null
    }));
  },
  clearPendingQA: () => set({ pendingQA: null }),

  // ============ 设置 ============
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  loadSettings: async () => {
    try {
      const data = await settingsApi.get();
      set({ settings: data });
    } catch (e) { console.error('加载设置失败', e); }
  },
  addToken: async (name, token) => {
    await settingsApi.addToken(name, token);
    await get().loadSettings();
  },
  updateToken: async (id, patch) => {
    await settingsApi.updateToken(id, patch);
    await get().loadSettings();
  },
  deleteToken: async (id) => {
    await settingsApi.deleteToken(id);
    await get().loadSettings();
  },
  setScenarioModel: async (scenario, model) => {
    await settingsApi.setScenarioModel(scenario, model);
    await get().loadSettings();
  },

  // ============ 项目面板 ============
  openProjectPanel: () => set({ projectPanelOpen: true }),
  closeProjectPanel: () => set({ projectPanelOpen: false }),
  loadProjectMeta: async () => {
    const { activeTopicId } = get();
    if (!activeTopicId) return;
    try {
      const data = await projectsApi.get(activeTopicId);
      set({ projectMeta: data.project });
    } catch { /* 项目未创建 */ }
  },

  setWorkfolder: async (path: string) => {
    const { activeTopicId } = get();
    if (!activeTopicId) return;
    try {
      await projectsApi.setWorkfolder(activeTopicId, path);
      await get().loadProjectMeta();
    } catch (e: any) {
      alert(e.message || '设置 workfolder 失败');
    }
  }
}));
