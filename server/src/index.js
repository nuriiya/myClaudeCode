import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { PORT, CLIENT_DIST_DIR } from './config.js';
import * as db from './db.js';
import { agentManager } from './agents/AgentManager.js';
import topicsRouter from './routes/topics.js';
import chatRouter from './routes/chat.js';
import settingsRouter from './routes/settings.js';
import projectsRouter from './routes/projects.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 挂载共享模块供路由使用
app.locals.Messages = db.Messages;
app.locals.Projects = db.Projects;
app.locals.Topics = db.Topics;
app.locals.agentManager = agentManager;

// 请求日志（后台日志）
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toLocaleString('zh-CN')}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// API 路由
app.use('/api/topics', topicsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/projects', projectsRouter);

// Agent 信息
app.get('/api/agents', (req, res) => {
  res.json({ code: 0, message: 'ok', data: agentManager.getAgentsInfo() });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { uptime: process.uptime(), agentCount: agentManager.getAgentsInfo().length } });
});

// 前端静态资源（生产模式：client/dist）
if (fs.existsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  });
}

// 404
app.use((req, res) => {
  res.status(404).json({ code: -1, message: '接口不存在', data: null });
});

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ code: -1, message: err?.message || '服务器内部错误', data: null });
});

app.listen(PORT, () => {
  console.log('==============================================');
  console.log('  AI 聊天协作软件 - 后端服务已启动');
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  端口: ${PORT}`);
  console.log('  已加载 Agents:');
  for (const a of agentManager.getAgentsInfo()) {
    console.log(`    ${a.icon} ${a.name} (${a.id}) -> ${a.model}`);
  }
  console.log('==============================================');
});
