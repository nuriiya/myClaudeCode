import { DatabaseSync } from 'node:sqlite';
import { ensureDirs, DB_PATH, DATA_DIR, WORKFOLDERS_DIR } from './config.js';

ensureDirs();

const db = new DatabaseSync(DB_PATH);

// 开启 WAL 提升并发性能
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ============ Schema ============
db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'chat',   -- chat | project
  stage      TEXT NOT NULL DEFAULT 'chat',   -- chat | clarify | docs | codegen
  agent      TEXT NOT NULL DEFAULT 'dialogue', -- 当前主导 Agent
  req_state  TEXT,                            -- 需求澄清状态 JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  topic_id   TEXT NOT NULL,
  role       TEXT NOT NULL,                  -- user | assistant | system | tool
  content    TEXT NOT NULL,
  meta       TEXT,                           -- 结构化扩展字段 JSON（含 qa 二次问答协议）
  agent      TEXT,                           -- 产生该消息的 Agent
  created_at INTEGER NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  topic_id   TEXT NOT NULL UNIQUE,
  folder     TEXT NOT NULL,                  -- workfolder 相对路径
  workfolder_path TEXT,                      -- 自定义 workfolder 绝对路径（可选）
  req_doc    TEXT,                           -- 需求文档文件名
  status     TEXT NOT NULL DEFAULT 'planning', -- planning | generating | generated | iterating
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_topic ON messages(topic_id, created_at);
`);

// ============ 迁移：为已有 projects 表添加 workfolder_path 列 ============
try {
  db.exec('ALTER TABLE projects ADD COLUMN workfolder_path TEXT');
} catch { /* 列已存在则忽略 */ }

// ============ Settings ============
export const Settings = {
  get(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },
  getJson(key, fallback = null) {
    const v = this.get(key);
    if (v == null) return fallback;
    try { return JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    const v = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, v);
  },
  all() {
    return db.prepare('SELECT key, value FROM settings').all();
  }
};

// ============ Topics ============
function now() { return Date.now(); }
function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const Topics = {
  create({ title = '新的对话', kind = 'chat' }) {
    const id = uid('topic');
    const t = now();
    db.prepare('INSERT INTO topics (id, title, kind, stage, agent, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, title, kind, 'chat', 'dialogue', t, t);
    return this.get(id);
  },
  get(id) {
    const row = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
    if (!row) return null;
    row.req_state = row.req_state ? JSON.parse(row.req_state) : null;
    return row;
  },
  list() {
    const rows = db.prepare(`
      SELECT t.*, (SELECT COUNT(*) FROM messages m WHERE m.topic_id = t.id) AS msg_count
      FROM topics t ORDER BY t.updated_at DESC`).all();
    for (const r of rows) r.req_state = r.req_state ? JSON.parse(r.req_state) : null;
    return rows;
  },
  update(id, patch) {
    const fields = [];
    const vals = [];
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'id') continue;
      fields.push(`${k} = ?`);
      if (v === undefined || v === null) vals.push(null);
      else if (typeof v === 'object') vals.push(JSON.stringify(v));
      else vals.push(v);
    }
    if (fields.length === 0) return this.get(id);
    fields.push('updated_at = ?');
    vals.push(now());
    db.prepare(`UPDATE topics SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id);
    return this.get(id);
  },
  remove(id) {
    // 级联删除：messages / projects / workfolder 目录由 workfolderService 处理
    db.prepare('DELETE FROM projects WHERE topic_id = ?').run(id);
    db.prepare('DELETE FROM messages WHERE topic_id = ?').run(id);
    db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  },
  clearMessages(id) {
    db.prepare('DELETE FROM messages WHERE topic_id = ?').run(id);
  }
};

// ============ Messages ============
export const Messages = {
  add({ topicId, role, content, meta = null, agent = null }) {
    const id = uid('msg');
    db.prepare('INSERT INTO messages (id, topic_id, role, content, meta, agent, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, topicId, role, content, meta ? JSON.stringify(meta) : null, agent, now());
    Topics.update(topicId, { updated_at: now() });
    return this.get(id);
  },
  get(id) {
    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!row) return null;
    row.meta = row.meta ? JSON.parse(row.meta) : null;
    return row;
  },
  updateContent(id, { content, meta, agent }) {
    db.prepare('UPDATE messages SET content = ?, meta = ?, agent = ? WHERE id = ?')
      .run(content, meta ? JSON.stringify(meta) : null, agent || null, id);
    return this.get(id);
  },
  listByTopic(topicId) {
    const rows = db.prepare('SELECT * FROM messages WHERE topic_id = ? ORDER BY created_at ASC').all(topicId);
    for (const r of rows) r.meta = r.meta ? JSON.parse(r.meta) : null;
    return rows;
  },
  // 获取最近 N 条用于上下文
  recent(topicId, limit = 20) {
    const rows = db.prepare('SELECT * FROM messages WHERE topic_id = ? ORDER BY created_at DESC LIMIT ?').all(topicId, limit);
    for (const r of rows) r.meta = r.meta ? JSON.parse(r.meta) : null;
    return rows.reverse();
  }
};

// ============ Projects ============
export const Projects = {
  create({ topicId, folder, reqDoc }) {
    const id = uid('proj');
    const t = now();
    db.prepare('INSERT INTO projects (id, topic_id, folder, req_doc, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, topicId, folder, reqDoc ?? null, 'planning', t, t);
    return this.getByTopic(topicId);
  },
  getByTopic(topicId) {
    const row = db.prepare('SELECT * FROM projects WHERE topic_id = ?').get(topicId);
    return row || null;
  },
  update(topicId, patch) {
    const fields = [];
    const vals = [];
    for (const [k, v] of Object.entries(patch)) {
      fields.push(`${k} = ?`);
      vals.push(v === undefined ? null : v);
    }
    if (fields.length === 0) return this.getByTopic(topicId);
    fields.push('updated_at = ?');
    vals.push(now());
    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE topic_id = ?`).run(...vals, topicId);
    return this.getByTopic(topicId);
  }
};

// ============ 工具 ============
export const genId = uid;
export const getDb = () => db;
export { DATA_DIR, WORKFOLDERS_DIR };
