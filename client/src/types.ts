// ============ 类型定义 ============

// 二次问答协议字段（后端结构化字段）
export interface QAPayload {
  question: string;
  option: string[];
  or: string;
  dimension?: string | null;
}

export interface CodegenMeta {
  files: string[];
  done: boolean;
}

export interface MessageMeta {
  qa?: QAPayload;
  docReady?: boolean;
  codegen?: CodegenMeta;
  fromQA?: boolean;
  originalQuestion?: string | null;
}

export interface ChatMessage {
  id: string;
  topicId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  meta: MessageMeta | null;
  agent?: string | null;
  createdAt: number;
  // 前端临时状态
  streaming?: boolean;
  error?: { code: string; message: string } | null;
}

export interface Topic {
  id: string;
  title: string;
  kind: string;
  stage: 'chat' | 'clarify' | 'docs' | 'codegen' | string;
  agent: string;
  req_state: any;
  msg_count?: number;
  created_at: number;
  updated_at: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  icon: string;
  desc: string;
  model: string;
  scenario: string;
  config: string;
}

export interface TokenItem {
  id: string;
  name: string;
  token: string; // 脱敏
  enabled: boolean;
  created_at: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  desc: string;
}

export interface SettingsData {
  deepseek: {
    tokens: TokenItem[];
    scenarioModels: Record<string, string>;
    models: ModelInfo[];
  };
  agents: Array<Pick<AgentInfo, 'id' | 'name' | 'icon' | 'desc' | 'model' | 'scenario'>>;
}

export interface ProjectMeta {
  id: string;
  topicId: string;
  folder: string;
  workfolder_path: string | null;
  req_doc: string | null;
  status: string;
  folderMeta: {
    dirName: string;
    path: string;
    fileCount: number;
    totalSize: number;
    files: Array<{ path: string; size: number; mtime: number }>;
  } | null;
}

// 阶段徽章配置
export const STAGE_LABEL: Record<string, { text: string; cls: string }> = {
  chat: { text: '日常对话', cls: 'bg-slate-100 text-slate-600' },
  clarify: { text: '需求澄清中', cls: 'bg-amber-100 text-amber-700' },
  docs: { text: '需求已就绪', cls: 'bg-emerald-100 text-emerald-700' },
  codegen: { text: '代码生产中', cls: 'bg-violet-100 text-violet-700' }
};
