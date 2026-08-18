import { Router } from 'express';
import { Topics } from '../db.js';
import { agentManager } from '../agents/AgentManager.js';

const router = Router();

// ---------- SSE 事件写入器 ----------
function createSender(res) {
  return {
    msgStart(id, agent) {
      sse(res, 'msg_start', { id, agent });
    },
    chunk(id, delta) {
      sse(res, 'chunk', { id, delta });
    },
    msgEnd(id, { content, agent, meta }) {
      sse(res, 'msg_end', { id, content, agent, meta: meta || null });
    },
    msgError(id, err) {
      sse(res, 'error', { id, code: err?.code || 'MODEL_ERROR', message: err?.message || '模型调用失败' });
    },
    topic(topic) {
      sse(res, 'topic', { topic });
    },
    done() {
      sse(res, 'done', {});
      res.end();
    }
  };
}

function sse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ---------- 发送消息（SSE 流式） ----------
// body: { topicId, content }
router.post('/', async (req, res) => {
  const { topicId, content } = req.body || {};
  if (!topicId) return res.status(400).json({ code: -1, message: 'topicId 必填', data: null });
  const text = String(content || '').trim();
  if (!text) return res.status(400).json({ code: -1, message: '消息内容不能为空', data: null });

  const topic = Topics.get(topicId);
  if (!topic) return res.status(404).json({ code: -1, message: '主题不存在', data: null });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sender = createSender(res);
  // 保持响应不中断
  const heartbeat = setInterval(() => { try { res.write(':hb\n\n'); } catch {} }, 15000);
  res.on('close', () => { clearInterval(heartbeat); });

  try {
    await agentManager.handleMessage(topic, text, sender);
  } catch (e) {
    try {
      sender.msgError('server', e);
      sse(res, 'done', {});
      res.end();
    } catch { /* client gone */ }
  } finally {
    clearInterval(heartbeat);
  }
});

// ---------- 二次问答回传 ----------
// body: { topicId, answer, originalQuestion }
router.post('/answer', async (req, res) => {
  const { topicId, answer, originalQuestion } = req.body || {};
  if (!topicId) return res.status(400).json({ code: -1, message: 'topicId 必填', data: null });
  const text = String(answer || '').trim();
  if (!text) return res.status(400).json({ code: -1, message: '回答不能为空', data: null });

  const topic = Topics.get(topicId);
  if (!topic) return res.status(404).json({ code: -1, message: '主题不存在', data: null });

  // 将回答记录到消息流（作为用户消息），标注来源为二次问答
  const { Messages } = req.app.locals;
  Messages.add({
    topicId,
    role: 'user',
    content: text,
    meta: { fromQA: true, originalQuestion: originalQuestion || null }
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sender = createSender(res);
  const heartbeat = setInterval(() => { try { res.write(':hb\n\n'); } catch {} }, 15000);
  res.on('close', () => { clearInterval(heartbeat); });

  try {
    const stage = topic.stage === 'clarify' ? 'requirement'
      : (topic.stage === 'codegen' ? 'codegen' : agentManager.route(topic, text));
    if (stage === 'requirement') await agentManager.runRequirement(topic, text, sender);
    else if (stage === 'codegen') await agentManager.runCodegen(topic, text, sender);
    else await agentManager.runDialogue(topic, text, sender);
    sender.done();
  } catch (e) {
    try {
      sender.msgError('server', e);
      sse(res, 'done', {});
      res.end();
    } catch { /* client gone */ }
  } finally {
    clearInterval(heartbeat);
  }
});

export default router;
