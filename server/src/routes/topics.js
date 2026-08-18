import { Router } from 'express';
import { Topics } from '../db.js';
import * as wf from '../services/workfolder.js';

const router = Router();

// 统一响应格式：{ code, message, data }
const ok = (res, data, message = 'ok') => res.json({ code: 0, message, data });
const fail = (res, message, status = 400) => res.status(status).json({ code: -1, message, data: null });

// ---------- 主题列表 ----------
router.get('/', (req, res) => {
  ok(res, Topics.list());
});

// ---------- 新建主题 ----------
router.post('/', (req, res) => {
  const { title, kind } = req.body || {};
  const topic = Topics.create({ title: title || '新的对话', kind: kind || 'chat' });
  ok(res, topic, '主题创建成功');
});

// ---------- 主题详情 ----------
router.get('/:id', (req, res) => {
  const topic = Topics.get(req.params.id);
  if (!topic) return fail(res, '主题不存在', 404);
  ok(res, topic);
});

// ---------- 重命名 ----------
router.patch('/:id', (req, res) => {
  const topic = Topics.get(req.params.id);
  if (!topic) return fail(res, '主题不存在', 404);
  const { title } = req.body || {};
  if (!title?.trim()) return fail(res, '标题不能为空');
  ok(res, Topics.update(topic.id, { title: title.trim() }), '已重命名');
});

// ---------- 删除主题（联动删除消息 / project / workfolder） ----------
router.delete('/:id', (req, res) => {
  const topic = Topics.get(req.params.id);
  if (!topic) return fail(res, '主题不存在', 404);
  const project = req.app.locals.Projects?.getByTopic?.(topic.id);
  if (project?.folder) {
    // 只删除默认 workfolder（不删除用户自定义目录）
    if (!project.workfolder_path) {
      wf.removeWorkfolder(project.folder);
    }
  }
  Topics.remove(topic.id);
  ok(res, null, '主题及关联数据已删除');
});

// ---------- 清空主题对话记录 ----------
router.post('/:id/clear', (req, res) => {
  const topic = Topics.get(req.params.id);
  if (!topic) return fail(res, '主题不存在', 404);
  Topics.clearMessages(topic.id);
  Topics.update(topic.id, { stage: 'chat', agent: 'dialogue', req_state: null });
  ok(res, null, '对话记录已清空');
});

// ---------- 主题消息列表 ----------
router.get('/:id/messages', (req, res) => {
  const topic = Topics.get(req.params.id);
  if (!topic) return fail(res, '主题不存在', 404);
  const { Messages } = req.app.locals;
  ok(res, Messages.listByTopic(topic.id));
});

export default router;
