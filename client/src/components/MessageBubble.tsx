import { useState } from 'react';
import { useStore } from '../store';
import { renderMarkdown } from '../utils/markdown';
import type { ChatMessage } from '../types';
import { IconDoc, IconFolder, IconSpark, IconRobot, IconCode } from './Icons';

const AGENT_META: Record<string, { icon: string; name: string; color: string }> = {
  dialogue: { icon: '💬', name: '对话交互 Agent', color: '#0284c7' },
  requirement: { icon: '📋', name: '需求澄清 Agent', color: '#d97706' },
  codegen: { icon: '⚙️', name: '代码生产 Agent', color: '#7c3aed' }
};

export default function MessageBubble({ msg }: { msg: ChatMessage }) {
  const { sendMessage, openProjectPanel, loadProjectMeta } = useStore();
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const agentMeta = AGENT_META[msg.agent || ''] || null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* ignore */ }
  };

  // 流式输入中
  if (msg.streaming) {
    return (
      <div className="flex gap-3 animate-fade-in">
        {agentMeta ? (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0" style={{ background: agentMeta.color + '1a' }}>{agentMeta.icon}</div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><IconRobot size={15} className="text-slate-400" /></div>
        )}
        <div className="max-w-[75%] min-w-[120px]">
          {agentMeta && <div className="text-[11px] font-medium mb-1" style={{ color: agentMeta.color }}>{agentMeta.name}</div>}
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-slate-200 shadow-sm">
            {msg.content ? (
              <div className="text-[14px] text-slate-700 whitespace-pre-wrap">{msg.content}<span className="animate-blink">▌</span></div>
            ) : (
              <div className="flex items-center gap-1.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 用户消息
  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[72%]">
          {msg.meta?.fromQA && (
            <div className="flex justify-end mb-1">
              <span className="text-[10px] px-1.5 py-px rounded-full bg-amber-50 text-amber-500 border border-amber-100">需求澄清回答</span>
            </div>
          )}
          <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-600 text-white text-[14px] shadow-sm whitespace-pre-wrap break-words">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  // AI 消息
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
        style={{ background: agentMeta ? agentMeta.color + '1a' : '#f1f5f9' }}>
        {agentMeta ? agentMeta.icon : <IconRobot size={15} className="text-slate-400" />}
      </div>
      <div className="max-w-[80%] flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold" style={{ color: agentMeta?.color || '#64748b' }}>
            {agentMeta?.name || 'AI 助手'}
          </span>
          <button onClick={copy} className="text-[10px] text-slate-400 hover:text-indigo-500 transition-colors">
            {copied ? '✓ 已复制' : '复制'}
          </button>
        </div>

        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-slate-200 shadow-sm">
          {/* 错误状态 */}
          {msg.error ? (
            <div className="flex items-start gap-2 text-[13px] text-red-600">
              <IconSpark size={14} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">{msg.error.message}</div>
                {msg.error.code && <div className="text-[11px] text-red-400 mt-0.5">错误码：{msg.error.code}</div>}
              </div>
            </div>
          ) : (
            <>
              {/* 需求文档 */}
              {msg.meta?.docReady ? (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-[12px] font-medium text-emerald-600 bg-emerald-50 rounded-lg px-2.5 py-1.5">
                    <IconDoc size={13} /> 需求架构文档已生成
                  </div>
                  <div className="md-body max-h-[480px] overflow-y-auto pr-1" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                    <button
                      onClick={async () => { await loadProjectMeta(); openProjectPanel(); }}
                      className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <IconDoc size={13} /> 查看需求文档
                    </button>
                    <button
                      onClick={() => sendMessage('开始生成代码')}
                      className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      <IconCode size={13} /> 开始生成代码
                    </button>
                  </div>
                </div>
              ) : msg.meta?.codegen ? (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-[12px] font-medium text-violet-600 bg-violet-50 rounded-lg px-2.5 py-1.5">
                    <IconCode size={13} /> 项目代码已生成
                  </div>
                  <div className="md-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  {msg.meta.codegen.files.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <button
                        onClick={async () => { await loadProjectMeta(); openProjectPanel(); }}
                        className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                      >
                        <IconFolder size={13} /> 浏览项目文件（{msg.meta.codegen.files.length} 个文件）
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="md-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
