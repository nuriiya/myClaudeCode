# 🤖 AI 协作工坊 · 多 Agent 智能开发平台

智能化 AI 聊天协作软件：区别于普通对话工具，核心主打 **多 Agent 协同工作、需求精准梳理、代码自动化生成** 全流程能力。

## ✨ 核心能力

| 能力 | 说明 |
|------|------|
| 🧠 双 DeepSeek 模型 | deepseek-v4-flash（高速对话）/ deepseek-v4-pro（深度推理），自由切换、场景化默认配置 |
| 🔑 可配置密钥 | 后台独立配置入口，Token 可随时更新/替换/启用/禁用，无需改代码、无需重启 |
| 👥 多 Agent 协同 | 对话交互 Agent + 需求澄清 Agent + 代码生产 Agent，分工明确、流程联动 |
| 📋 需求精准梳理 | 多轮主动问答 + 智能二次交互（结构化 question/option/or 字段），生成标准化需求架构文档 |
| ⚙️ 自动化代码生产 | Claude CLI 式工作流：任务拆解 → 分步执行 → 结果校验 → 迭代优化，独立 workfolder 项目隔离 |
| 💾 全量持久化 | 对话记录、需求文档、代码文件、日志全部持久化，刷新不丢失 |

## 🚀 快速启动

### 前置要求
- Node.js ≥ 22.5（推荐 22.x）
- 一个 DeepSeek API Token（[platform.deepseek.com](https://platform.deepseek.com)）

### 方式一：一键启动 / 停止（Windows，推荐）

```powershell
# 启动（自动打开浏览器）
powershell -ExecutionPolicy Bypass -File start.ps1

# 停止
powershell -ExecutionPolicy Bypass -File stop.ps1
```

`start.ps1` 会自动检测端口占用、启动前后端、保存进程 PID；`stop.ps1` 按端口查找并终止进程树（含子进程），无需手动 taskkill。

### 方式二：手动启动

```bash
# 终端 1：后端（端口 3001）
cd server
npm install
npm start

# 终端 2：前端（端口 5173）
cd client
npm install
npm run dev
```

访问 **http://localhost:5173**，在左下角「DeepSeek 密钥与模型配置」中添加 Token 即可开始使用。

## 🎯 使用流程（业务闭环）

1. **新建对话主题**，发起初始需求（如「帮我开发一个个人博客网站」）
2. **对话 Agent** 承接对话，检测到开发意图后移交
3. **需求澄清 Agent** 介入，通过智能提问 + 前端二次交互，逐步完善需求（每次 1 个问题，不堆砌）
4. 需求梳理完成 → **自动生成标准化需求架构文档**（存入 workfolder）
5. 点击「开始生成代码」→ **代码生产 Agent** 在独立 workfolder 中自动化生成项目代码
6. 全程对话可留存、可管理、可删除；可基于二次反馈**迭代修改代码**

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────┐
│                   前端 (React + Vite)            │
│  对话界面 │ 主题管理 │ 二次问答 │ 项目文件面板     │
└──────────────────────┬──────────────────────────┘
                       │ REST + SSE 流式
┌──────────────────────┴──────────────────────────┐
│             后端 (Node.js + Express)             │
│  ┌──────────────────────────────────────────┐   │
│  │           AgentManager 编排核心           │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ 对话交互 │→│ 需求澄清  │→│ 代码生产  │  │   │
│  │  │  Agent  │ │  Agent   │ │  Agent   │  │   │
│  │  └─────────┘ └──────────┘ └──────────┘  │   │
│  │       ↑ 能力由 MD 文档配置驱动 ↑          │   │
│  └──────────┬──────────────┬───────────────┘   │
│   SQLite 持久化 │ DeepSeek 双模型 │ workfolder  │
└─────────────────────────────────────────────────┘
```

## 🧩 多 Agent 协同架构

### Agent 1：对话交互 Agent（💬）
- 承接日常对话、基础答疑、简单指令
- 检测到开发意图时引导至需求澄清 Agent
- 可接收其他 Agent 状态反馈，同步上下文

### Agent 2：需求澄清 Agent（📋）— 核心刚需
- 多轮主动提问，每次只问 1 个问题，动态调整提问方向
- 覆盖 8 大维度：项目类型/目标用户/核心功能/页面结构/技术要求/数据存储/视觉风格/交付边界
- 输出标准化**项目需求架构文档**

### Agent 3：代码生产 Agent（⚙️）
- 仅在需求文档生成后触发
- 内置 workfolder 机制，项目级数据隔离
- 分文件产出、中文注释、迭代优化

**Agent 能力配置化管理**：所有 Agent 的角色定位、提问逻辑、输出规范定义在
`server/src/agents/configs/*.md`，修改 MD 文件即可更新 Agent 能力，**无需改动业务代码**。
新增 Agent：在 `AgentManager.js` 的 `AGENT_DEFS` 注册 + 添加 MD 配置即可。

## 🔄 智能二次问答协议

后端 AI 响应携带结构化字段时，前端自动触发专属交互模块（替代普通文本展示）：

```json
{
  "question": "需要用户补充/确认的问题",
  "option": ["预设选项1", "预设选项2"],
  "or": "其他（可自定义输入）",
  "dimension": "对应需求维度"
}
```

交互流程：识别字段 → 锁定输入框 → 展示问题+选项 → 用户选择/自定义 → 专属按钮回传 → 后端继续梳理。

## 📁 数据目录

```
server/data/
├── app.db               # SQLite 数据库（主题/消息/设置/项目）
└── workfolders/         # 项目工作目录（需求文档/代码/日志）
    └── <项目名>__<id>/
        ├── docs/需求架构文档.md
        ├── src/...
        ├── README.md
        └── logs/workflow.log
```

## 🛠️ 技术栈

- **后端**：Node.js 22 + Express + node:sqlite（零原生依赖）+ SSE 流式
- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **模型**：DeepSeek V4 双模型（flash / pro）

## 🧪 测试

```bash
# 1. 解析器单元测试（无需外部服务）
cd server && node scripts/unit-parse-test.mjs

# 2. 全流程集成测试（需 mock 服务 + mock 模式后端）
cd server && node scripts/mock-deepseek.mjs            # 终端1：mock API (3999)
DEEPSEEK_API_BASE=http://localhost:3999 node src/index.js   # 终端2：后端 (3001)
node scripts/e2e-test.mjs                              # 终端3：跑测试

# 3. 格式自愈机制验证（坏格式恢复链路）
cd server && node scripts/mock-broken.mjs              # 终端1：坏格式 mock (3998)
PORT=3002 DEEPSEEK_API_BASE=http://localhost:3998 node src/index.js  # 终端2
node scripts/self-heal-test.mjs                        # 终端3
```
