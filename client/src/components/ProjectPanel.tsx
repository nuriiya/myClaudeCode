import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { projectsApi } from '../api';
import { renderMarkdown } from '../utils/markdown';
import { IconClose, IconDoc, IconFile, IconFolder, IconEdit, IconRefresh } from './Icons';

// ============================================================
// 项目文件面板
// 展示 workfolder 文件树、文件内容预览、需求文档查看
// 支持自定义 workfolder 路径设置
// ============================================================

type ViewMode = 'files' | 'requirement';

export default function ProjectPanel() {
  const { activeTopicId, projectMeta, projectPanelOpen, closeProjectPanel, loadProjectMeta, setWorkfolder } = useStore();
  const [mode, setMode] = useState<ViewMode>('files');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [reqContent, setReqContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  // workfolder 编辑状态
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const [savingPath, setSavingPath] = useState(false);

  useEffect(() => {
    if (projectPanelOpen && activeTopicId) {
      loadProjectMeta();
    }
  }, [projectPanelOpen, activeTopicId]);

  useEffect(() => {
    if (mode === 'requirement' && activeTopicId && reqContent === null) {
      projectsApi.requirement(activeTopicId).then(r => setReqContent(r.content)).catch(() => setReqContent(null));
    }
  }, [mode, activeTopicId]);

  if (!projectPanelOpen || !projectMeta?.folderMeta) return null;

  const files = projectMeta.folderMeta.files;
  const customPath = projectMeta.workfolder_path;
  const displayPath = customPath || projectMeta.folderMeta.path;

  const openFile = async (path: string) => {
    if (!activeTopicId) return;
    setSelectedFile(path);
    setLoadingFile(true);
    try {
      const r = await projectsApi.file(activeTopicId, path);
      setFileContent(r.content);
    } catch {
      setFileContent('（文件读取失败）');
    }
    setLoadingFile(false);
  };

  const handleSavePath = async () => {
    setSavingPath(true);
    await setWorkfolder(pathInput.trim());
    setSavingPath(false);
    setEditingPath(false);
  };

  const handleResetPath = async () => {
    setSavingPath(true);
    await setWorkfolder('');
    setSavingPath(false);
    setEditingPath(false);
  };

  // 文件树分组（按顶层目录）
  const groups = new Map<string, typeof files>();
  for (const f of files) {
    const top = f.path.includes('/') ? f.path.split('/')[0] : '(根目录)';
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top)!.push(f);
  }

  const isCode = (p: string) => /\.(js|ts|jsx|tsx|html|css|py|json|vue|java|go|rs|md|sql|sh)$/i.test(p);

  return (
    <aside className="w-[360px] h-full flex flex-col border-l border-slate-200 bg-white shrink-0 animate-fade-in">
      {/* 头部 */}
      <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-slate-200">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-800">
          <IconFolder size={15} className="text-indigo-500" /> 项目文件
        </div>
        <button onClick={closeProjectPanel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
          <IconClose size={15} />
        </button>
      </div>

      {/* Workfolder 路径设置 */}
      <div className="px-3 pt-3 shrink-0">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Workfolder</span>
            {!editingPath && (
              <button
                onClick={() => { setPathInput(customPath || ''); setEditingPath(true); }}
                className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-600 font-medium"
              >
                <IconEdit size={11} /> {customPath ? '修改' : '设置'}
              </button>
            )}
          </div>
          {!editingPath ? (
            <div className="flex items-center gap-1.5">
              {customPath && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="自定义目录" />}
              <p className="text-[12px] text-slate-600 font-mono break-all leading-relaxed" title={displayPath}>
                {displayPath}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                placeholder="输入绝对路径，如 E:\projects\my-app"
                className="w-full text-[12px] font-mono px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 outline-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSavePath}
                  disabled={savingPath || !pathInput.trim()}
                  className="text-[11px] px-3 py-1 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 font-medium"
                >
                  {savingPath ? '保存中…' : '保存'}
                </button>
                {customPath && (
                  <button
                    onClick={handleResetPath}
                    disabled={savingPath}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-200"
                  >
                    <IconRefresh size={10} /> 恢复默认
                  </button>
                )}
                <button
                  onClick={() => setEditingPath(false)}
                  className="text-[11px] px-2 py-1 rounded-lg text-slate-400 hover:bg-slate-200"
                >
                  取消
                </button>
              </div>
            </div>
          )}
          {customPath && !editingPath && (
            <p className="text-[10px] text-emerald-600 mt-1.5">✓ 代码将生成到此自定义目录</p>
          )}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex px-3 pt-2.5 gap-1 shrink-0">
        <button
          onClick={() => setMode('files')}
          className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition-colors ${mode === 'files' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <IconFile size={12} /> 文件（{files.length}）
        </button>
        <button
          onClick={() => setMode('requirement')}
          className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition-colors ${mode === 'requirement' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <IconDoc size={12} /> 需求文档
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {mode === 'files' && (
          <div className="space-y-2.5">
            {[...groups.entries()].map(([dir, fs]) => (
              <div key={dir}>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 px-1 py-0.5">
                  <IconFolder size={12} className="text-amber-400" /> {dir}/
                </div>
                <div className="ml-3 border-l border-slate-100 pl-2 space-y-0.5">
                  {fs.map(f => (
                    <button
                      key={f.path}
                      onClick={() => openFile(f.path)}
                      className={`w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-colors ${
                        selectedFile === f.path ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <IconFile size={12} className={isCode(f.path) ? 'text-indigo-400' : 'text-slate-300'} />
                        <span className="truncate font-mono">{f.path.replace(dir === '(根目录)' ? '' : dir + '/', '')}</span>
                      </span>
                      <span className="text-[10px] text-slate-300 shrink-0">{fmtSize(f.size)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {mode === 'requirement' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            {reqContent ? (
              <div className="md-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(reqContent) }} />
            ) : (
              <div className="text-center text-[13px] text-slate-400 py-8">
                {reqContent === null ? '需求文档尚未生成，请先完成需求澄清' : '加载中…'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 文件内容预览 */}
      {selectedFile && (
        <div className="h-1/2 shrink-0 border-t border-slate-200 flex flex-col bg-slate-900">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800">
            <span className="text-[11px] text-slate-300 font-mono truncate">{selectedFile}</span>
            <button onClick={() => { setSelectedFile(null); setFileContent(null); }} className="text-slate-400 hover:text-white"><IconClose size={12} /></button>
          </div>
          <pre className="flex-1 overflow-auto p-3 text-[12px] leading-relaxed text-slate-200 font-mono">
            {loadingFile ? '加载中…' : fileContent}
          </pre>
        </div>
      )}
    </aside>
  );
}

function fmtSize(n: number) {
  if (n < 1024) return n + 'B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'KB';
  return (n / 1024 / 1024).toFixed(1) + 'MB';
}
