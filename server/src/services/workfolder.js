import fs from 'node:fs';
import path from 'node:path';
import { WORKFOLDERS_DIR } from '../config.js';

// ============================================================
// workfolder 工作目录服务
// 每个项目对应独立目录：需求文档 / 代码文件 / 日志 / 迭代记录
// ============================================================

function sanitizeName(name) {
  return String(name || 'project')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'project';
}

export function createWorkfolder(topicId, projectName) {
  const dirName = `${sanitizeName(projectName)}__${topicId.slice(0, 8)}`;
  const dir = path.join(WORKFOLDERS_DIR, dirName);
  fs.mkdirSync(dir, { recursive: true });
  for (const sub of ['docs', 'src', 'logs']) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  return { dirName, dir };
}

export function getWorkfolderPath(dirNameOrPath) {
  if (!dirNameOrPath) return null;
  // 如果是绝对路径（自定义 workfolder），直接使用
  if (path.isAbsolute(dirNameOrPath)) {
    return fs.existsSync(dirNameOrPath) ? dirNameOrPath : null;
  }
  // 否则作为相对路径解析到 WORKFOLDERS_DIR
  const dir = path.resolve(WORKFOLDERS_DIR, dirNameOrPath);
  // 防目录穿越
  if (!dir.startsWith(path.resolve(WORKFOLDERS_DIR))) return null;
  return fs.existsSync(dir) ? dir : null;
}

// 确保自定义目录存在（含子目录）
export function ensureCustomDir(absPath) {
  if (!absPath || !path.isAbsolute(absPath)) return;
  fs.mkdirSync(absPath, { recursive: true });
  for (const sub of ['docs', 'src', 'logs']) {
    fs.mkdirSync(path.join(absPath, sub), { recursive: true });
  }
}

export function writeFile(dirName, relPath, content) {
  const dir = getWorkfolderPath(dirName);
  if (!dir) throw new Error('workfolder 不存在');
  const full = path.resolve(dir, relPath);
  if (!full.startsWith(path.resolve(dir))) throw new Error('非法路径');
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return relPath;
}

export function writeRequirementDoc(dirName, content) {
  const rel = 'docs/需求架构文档.md';
  writeFile(dirName, rel, content);
  return rel;
}

export function writeProjectReadme(dirName, content) {
  const rel = 'README.md';
  writeFile(dirName, rel, content);
  return rel;
}

export function appendLog(dirName, entry) {
  const dir = getWorkfolderPath(dirName);
  if (!dir) return;
  const log = path.join(dir, 'logs', 'workflow.log');
  fs.appendFileSync(log, `[${new Date().toLocaleString('zh-CN')}] ${entry}\n`, 'utf8');
}

export function listFiles(dirName, base = '') {
  const dir = getWorkfolderPath(dirName);
  if (!dir) return [];
  const target = path.join(dir, base);
  const out = [];
  const walk = (cur, prefix) => {
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '.cache') continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(cur, e.name), rel);
      else {
        const stat = fs.statSync(path.join(cur, e.name));
        out.push({ path: rel, size: stat.size, mtime: stat.mtimeMs });
      }
    }
  };
  walk(target, '');
  return out;
}

export function readFile(dirName, relPath) {
  const dir = getWorkfolderPath(dirName);
  if (!dir) return null;
  const full = path.resolve(dir, relPath);
  if (!full.startsWith(path.resolve(dir))) return null;
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

export function removeWorkfolder(dirName) {
  if (!dirName) return;
  const dir = getWorkfolderPath(dirName);
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    // 删除失败时改为重命名标记为已删除，避免残留阻碍后续操作
    try {
      const tomb = dir + '.deleted';
      if (!fs.existsSync(tomb)) fs.renameSync(dir, tomb);
      else fs.rmSync(tomb, { recursive: true, force: true }) && fs.renameSync(dir, tomb);
    } catch { /* 保留原目录 */ }
  }
}

export function getWorkfolderMeta(dirName) {
  const dir = getWorkfolderPath(dirName);
  if (!dir) return null;
  const files = listFiles(dirName);
  const total = files.reduce((s, f) => s + f.size, 0);
  return { dirName, path: dir, fileCount: files.length, totalSize: total, files };
}
