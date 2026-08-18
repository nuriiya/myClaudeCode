import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 项目根目录
export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const SERVER_DIR = path.resolve(__dirname, '..');

// 数据目录：数据库、workfolder、需求文档
export const DATA_DIR = path.join(SERVER_DIR, 'data');
export const DB_PATH = path.join(DATA_DIR, 'app.db');
export const WORKFOLDERS_DIR = path.join(DATA_DIR, 'workfolders');
export const AGENTS_CONFIG_DIR = path.join(__dirname, 'agents', 'configs');
export const CLIENT_DIST_DIR = path.join(ROOT_DIR, 'client', 'dist');

// 服务端口
export const PORT = process.env.PORT || 3001;

// DeepSeek API 默认配置（支持环境变量覆盖，便于测试/自定义网关）
export const DEEPSEEK_API_BASE = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com';

// 模型定义（双模型自由切换）
export const MODELS = {
  flash: {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    desc: '高速对话模型，适合日常交互、快速响应',
    defaultScenario: 'dialog'
  },
  pro: {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    desc: '深度推理模型，适合需求梳理、代码生成',
    defaultScenario: 'reasoning'
  }
};

// 场景 -> 默认模型
export const SCENARIO_MODELS = {
  dialog: 'deepseek-v4-flash',   // 日常对话 / 高速
  reasoning: 'deepseek-v4-pro'   // 需求澄清 / 深度推理
};

// 默认 Agent 场景映射
export const AGENT_SCENARIO = {
  dialogue: 'dialog',
  requirement: 'reasoning',
  codegen: 'reasoning'
};

// 请求超时（毫秒）
export const MODEL_TIMEOUT = 240000;

// 需求维度（供 RequirementAgent 使用，也可被 MD 配置覆盖）
export const DEFAULT_REQ_DIMENSIONS = [
  '项目类型',
  '目标用户',
  '核心功能',
  '页面结构',
  '技术要求',
  '数据与存储',
  '视觉风格',
  '交付边界'
];

export function ensureDirs() {
  for (const dir of [DATA_DIR, WORKFOLDERS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}
