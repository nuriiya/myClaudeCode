```md
# AI Agent 协作聊天应用

面向个人开发者的 AI 聊天工作台，主控 Agent 解析用户意图，按需调用提问 Agent 或生产 Agent，完成需求澄清与代码生成。

## 快速开始

### 1. 安装依赖
```bash
npm run setup
```

### 2. 配置 Deepseek Token
复制 `.env.example` 为 `.env` 并填入你的 token，或在启动后通过设置页配置（仅保存在内存中）。

### 3. 启动开发服务
```bash
npm run dev
```
- 后端：http://localhost:3001
- 前端：http://localhost:5173

## 功能特性
- 聊天主界面，支持多轮对话
- 历史会话列表，可查看/删除
- 设置页：token 配置、主题切换、Agent 定义查看/编辑
- 主控 Agent 自动判断意图，调度提问/生产 Agent
- 提问 Agent 多轮问答，生成需求文档
- 生产 Agent 根据需求生成代码到 workfolder
- 科技感视觉风格（渐变、动效）

## 目录结构
```
├── server/          # 后端
│   ├── agents/      # Agent 实现与定义文件
│   ├── routes/      # API 路由
│   ├── utils/       # 工具（LLM 调用）
│   ├── db.js        # SQLite 初始化
│   └── index.js     # 入口
└── client/          # 前端
    └── src/
        ├── components/  # 组件
        ├── api.js       # API 封装
        └── styles.css   # 全局样式
```