```js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT '新对话',
      meta TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      agent TEXT DEFAULT '用户',
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // 默认设置
  const defaults = {
    theme: 'dark',
    workfolder: './workfolder',
    model: 'deepseek-chat',
    apiBase: 'https://api.deepseek.com'
  };
  for (const [key, val] of Object.entries(defaults)) {
    const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!existing) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, val);
    }
  }
}

module.exports = db;
module.exports.init = init;