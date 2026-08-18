```js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const db = require('./db');
const conversationsRouter = require('./routes/conversations');
const chatRouter = require('./routes/chat');
const settingsRouter = require('./routes/settings');
const agentsRouter = require('./routes/agents');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 初始化数据库
db.init();

app.use('/api/conversations', conversationsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/agents', agentsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', tokenSet: !!process.env.DEEPSEEK_TOKEN });
});

app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}`);
});