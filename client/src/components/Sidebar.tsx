import { useState } from 'react';
import { useStore } from '../store';
import { STAGE_LABEL, type Topic } from '../types';
import { IconPlus, IconTrash, IconEdit, IconSettings, IconRefresh, IconRobot } from './Icons';

const AGENT_META: Record<string, { icon: string; name: string; color: string }> = {
  dialogue: { icon: '💬', name: '对话交互', color: 'bg-sky-50 text-sky-600' },
  requirement: { icon: '📋', name: '需求澄清', color: 'bg-amber-50 text-amber-600' },
  codegen: { icon: '⚙️', name: '代码生产', color: 'bg-violet-50 text-violet-600' }
};

export default function Sidebar() {
  const { topics, activeTopicId, selectTopic, createTopic, renameTopic, deleteTopic, clearTopic, openSettings, loadTopics } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const startEdit = (t: Topic) => {
    setEditingId(t.id);
    setEditTitle(t.title);
  };

  const commitEdit = async (id: string) => {
    const title = editTitle.trim();
    setEditingId(null);
    if (title) await renameTopic(id, title);
  };

  return (
    <aside className="w-72 h-full flex flex-col border-r border-slate-200 bg-white">
      {/* Logo 区 */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm">
            <IconRobot size={20} />
          </div>
          <div>
            <div className="font-bold text-[15px] text-slate-800 leading-tight">AI 协作工坊</div>
            <div className="text-[11px] text-slate-400">多 Agent 智能开发 · DeepSeek 双模型</div>
          </div>
        </div>

        {/* Agent 状态 */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {Object.entries(AGENT_META).map(([id, meta]) => (
            <div key={id} className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-medium ${meta.color}`} title={meta.name}>
              <span>{meta.icon}</span>
              <span className="truncate">{meta.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 新建按钮 */}
      <div className="px-3 py-2.5">
        <button
          onClick={() => createTopic()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium transition-colors shadow-sm"
        >
          <IconPlus size={15} /> 新建对话主题
        </button>
        <button
          onClick={() => { loadTopics(); }}
          className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <IconRefresh size={12} /> 刷新列表
        </button>
      </div>

      {/* 主题列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="px-2 pb-1 text-[11px] font-medium text-slate-400 flex items-center gap-1">
          对话主题 <span className="text-slate-300">({topics.length})</span>
        </div>
        {topics.length === 0 && (
          <div className="px-2 py-8 text-center text-xs text-slate-400">
            暂无对话主题
            <br />点击上方按钮新建
          </div>
        )}
        {topics.map(t => {
          const active = t.id === activeTopicId;
          const stage = STAGE_LABEL[t.stage] || STAGE_LABEL.chat;
          const meta = AGENT_META[t.agent] || AGENT_META.dialogue;
          return (
            <div
              key={t.id}
              onClick={() => selectTopic(t.id)}
              className={`group mb-1 px-2.5 py-2 rounded-xl cursor-pointer transition-colors ${active ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
            >
              {editingId === t.id ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => commitEdit(t.id)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(t.id); if (e.key === 'Escape') setEditingId(null); }}
                  onClick={e => e.stopPropagation()}
                  className="w-full text-[13px] px-1.5 py-0.5 rounded border border-indigo-300 outline-none focus:ring-1 focus:ring-indigo-400"
                />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex-1 text-[13px] font-medium text-slate-700 truncate">{t.title}</div>
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => startEdit(t)} className="p-1 rounded hover:bg-indigo-100 text-slate-400 hover:text-indigo-600" title="重命名"><IconEdit /></button>
                      <button onClick={() => clearTopic(t.id)} className="p-1 rounded hover:bg-amber-100 text-slate-400 hover:text-amber-600" title="清空记录"><IconRefresh size={12} /></button>
                      <button onClick={() => deleteTopic(t.id)} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600" title="删除"><IconTrash /></button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-px rounded-full bg-slate-100 text-slate-500 flex items-center gap-0.5">
                      <span>{meta.icon}</span>{meta.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-px rounded-full ${stage.cls}`}>{stage.text}</span>
                    {t.kind === 'project' && <span className="text-[10px] px-1.5 py-px rounded-full bg-violet-50 text-violet-500">📦 项目</span>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部 */}
      <div className="p-3 border-t border-slate-100">
        <button onClick={openSettings} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-[13px] text-slate-500 transition-colors">
          <IconSettings size={14} /> DeepSeek 密钥与模型配置
        </button>
      </div>
    </aside>
  );
}
