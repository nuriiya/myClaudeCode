import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Topics, Projects } from '../db.js';
import * as wf from '../services/workfolder.js';

const router = Router();
const ok = (res, data, message = 'ok') => res.json({ code: 0, message, data });
const fail = (res, message, status = 400) => res.status(status).json({ code: -1, message, data: null });

// 解析项目的工作目录（自定义路径优先）
function resolveProjectDir(project) {
  if (!project) return null;
  return project.workfolder_path || project.folder;
}

// ---------- 获取某主题的项目信息 + workfolder 元数据 ----------
router.get('/topic/:topicId', (req, res) => {
  const topic = Topics.get(req.params.topicId);
  if (!topic) return fail(res, '主题不存在', 404);
  const project = Projects.getByTopic(topic.id);
  if (!project) return ok(res, { project: null });

  const dir = resolveProjectDir(project);
  const meta = dir ? wf.getWorkfolderMeta(dir) : null;
  ok(res, {
    project: {
      ...project,
      folderMeta: meta
    }
  });
});

// ---------- 设置自定义 workfolder 路径 ----------
router.put('/topic/:topicId/workfolder', (req, res) => {
  const topic = Topics.get(req.params.topicId);
  if (!topic) return fail(res, '主题不存在', 404);
  const project = Projects.getByTopic(topic.id);
  if (!project) return fail(res, '项目尚未创建，请先完成需求澄清', 404);

  const { workfolderPath } = req.body || {};
  const p = String(workfolderPath || '').trim();

  if (!p) {
    // 清除自定义路径，回退到默认 workfolder
    Projects.update(topic.id, { workfolder_path: null });
    return ok(res, { project: Projects.getByTopic(topic.id) }, '已恢复默认 workfolder');
  }

  // 验证路径：必须是绝对路径
  if (!path.isAbsolute(p)) {
    return fail(res, '路径必须是绝对路径（如 E:\\projects\\my-app）');
  }

  // 创建目录（如不存在）
  try {
    wf.ensureCustomDir(p);
  } catch (e) {
    return fail(res, `无法创建目录: ${e.message}`);
  }

  // 验证目录可写
  try {
    const testFile = path.join(p, '.workfolder_test');
    fs.writeFileSync(testFile, 'ok');
    // 不删除测试文件（避免触发安全删除机制），留作目录标记
  } catch (e) {
    return fail(res, `目录不可写: ${e.message}`);
  }

  // 如果有需求文档，复制到新目录
  if (project.req_doc) {
    const oldDir = project.folder;
    const oldDoc = wf.readFile(oldDir, project.req_doc);
    if (oldDoc) {
      wf.writeFile(p, project.req_doc, oldDoc);
    }
  }

  Projects.update(topic.id, { workfolder_path: p });
  const updated = Projects.getByTopic(topic.id);
  ok(res, { project: updated }, 'workfolder 路径已更新');
});

// ---------- 读取 workfolder 文件内容 ----------
router.get('/topic/:topicId/file', (req, res) => {
  const topic = Topics.get(req.params.topicId);
  if (!topic) return fail(res, '主题不存在', 404);
  const project = Projects.getByTopic(topic.id);
  if (!project) return fail(res, '该项目尚未生成代码', 404);

  const dir = resolveProjectDir(project);
  const relPath = req.query.path;
  if (!relPath) return fail(res, '缺少 path 参数');
  const content = wf.readFile(dir, String(relPath));
  if (content === null) return fail(res, '文件不存在', 404);
  ok(res, { path: relPath, content, size: content.length });
});

// ---------- 读取需求文档 ----------
router.get('/topic/:topicId/requirement', (req, res) => {
  const topic = Topics.get(req.params.topicId);
  if (!topic) return fail(res, '主题不存在', 404);
  const project = Projects.getByTopic(topic.id);
  if (!project?.req_doc) return fail(res, '需求文档尚未生成', 404);
  const dir = resolveProjectDir(project);
  const content = wf.readFile(dir, project.req_doc);
  if (content === null) return fail(res, '需求文档文件缺失', 404);
  ok(res, { path: project.req_doc, content });
});

export default router;
