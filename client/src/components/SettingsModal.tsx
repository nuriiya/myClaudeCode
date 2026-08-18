import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { settingsApi } from '../api';
import { IconClose, IconKey, IconRefresh, IconSpark } from './Icons';

// ============================================================
// 设置面板：DeepSeek Token 管理 + 场景默认模型 + Agent 信息
// ============================================================

export default function SettingsModal() {
  const { settings, settingsOpen, closeSettings, loadSettings, addToken, updateToken, deleteToken, setScenarioModel } = useStore();
  const [newName, setNewName] = useState('');
  const [newToken, setNewToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (settingsOpen) loadSettings();
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const tokens = settings?.deepseek?.tokens || [];
  const scenarioModels = settings?.deepseek?.scenarioModels || {};
  const models = settings?.deepseek?.models || [];
  const agents = settings?.agents || [];
  const enabledCount = tokens.filter(t => t.enabled).length;

  const handleAdd = async () => {
    if (!newToken.trim()) return alert('请输入 Token');
    setAdding(true);
    try {
      await addToken(newName.trim() || '默认Key', newToken.trim());
      setNewName(''); setNewToken('');
    } catch (e: any) {
      alert(e.message || '添加失败');
    }
    setAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={closeSettings}>
      <div className="w-[680px] max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="text-[16px] font-bold text-slate-800">DeepSeek 模型配置</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Token 可随时更新、替换、启用/禁用，无需修改代码、重启服务</div>
          </div>
          <button onClick={closeSettings} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><IconClose /></button>
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-70px)] px-5 py-4 space-y-5">
          {/* Token 管理 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                <IconKey size={14} className="text-indigo-500" /> API Token 管理
                <span className="text-[11px] font-normal text-slate-400">（已启用 {enabledCount}/{tokens.length}）</span>
              </h3>
            </div>

            {tokens.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[12px] text-slate-400">
                尚未配置 Token，请添加 DeepSeek API Token（https://platform.deepseek.com）
              </div>
            )}

            <div className="space-y-2">
              {tokens.map(t => (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${t.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-slate-700 truncate">{t.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{t.token}</div>
                  </div>
                  <button
                    onClick={() => updateToken(t.id, { enabled: !t.enabled })}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                      t.enabled
                        ? 'text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-500'
                        : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    {t.enabled ? '禁用' : '启用'}
                  </button>
                  <button onClick={() => { if (confirm(`确定删除 Token「${t.name}」？`)) deleteToken(t.id); }}
                    className="text-[11px] px-2.5 py-1 rounded-lg text-slate-400 border border-slate-200 hover:text-red-500 hover:border-red-300 transition-colors">
                    删除
                  </button>
                </div>
              ))}
            </div>

            {/* 新增 Token */}
            <div className="mt-3 rounded-xl border border-slate-200 p-3">
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="备注名（如：主账号）"
                  className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-indigo-300"
                />
                <input
                  value={newToken}
                  onChange={e => setNewToken(e.target.value)}
                  type={showToken ? 'text' : 'password'}
                  placeholder="sk-... 粘贴 DeepSeek API Token"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-indigo-300 font-mono"
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={showToken} onChange={e => setShowToken(e.target.checked)} className="accent-indigo-500" />
                  显示明文
                </label>
                <button
                  onClick={handleAdd}
                  disabled={adding || !newToken.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-medium disabled:opacity-40 transition-colors"
                >
                  {adding ? '添加中…' : '＋ 添加 Token'}
                </button>
              </div>
            </div>
          </section>

          {/* 场景默认模型 */}
          <section>
            <h3 className="text-[13px] font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <IconSpark size={14} className="text-violet-500" /> 场景默认模型
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(scenarioModels).map(([scenario, model]) => (
                <div key={scenario} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-[12px] font-medium text-slate-600 mb-1.5">
                    {scenario === 'dialog' ? '💬 日常对话场景' : '🧠 深度推理场景'}
                    <span className="text-[10px] text-slate-400 ml-1">（{scenario === 'dialog' ? '高速优先' : '深度优先'}）</span>
                  </div>
                  <select
                    value={model}
                    onChange={e => setScenarioModel(scenario, e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] outline-none focus:border-indigo-300 bg-white"
                  >
                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <div className="text-[10px] text-slate-400 mt-1">{models.find(m => m.id === model)?.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Agent 信息 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                <IconRefresh size={13} className="text-emerald-500" /> Agent 协同架构
                <span className="text-[11px] font-normal text-slate-400">（能力由 MD 文档配置驱动）</span>
              </h3>
              <button onClick={() => { useStore.getState().settings && (settingsApiReload()); }}
                className="text-[11px] px-2.5 py-1 rounded-lg text-slate-500 border border-slate-200 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                热重载配置
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {agents.map(a => (
                <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                    <span>{a.icon}</span> {a.name.replace(' Agent', '')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{a.desc}</div>
                  <div className="mt-2 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 inline-block font-mono">{a.model}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function settingsApiReload() {
  settingsApi.reloadAgents().then(() => {
    useStore.getState().loadSettings();
    alert('Agent 配置已热重载');
  }).catch(() => alert('重载失败'));
}
