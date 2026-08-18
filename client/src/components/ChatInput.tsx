import { useState } from 'react';
import { useStore } from '../store';
import { IconSend } from './Icons';

export default function ChatInput() {
  const { sendMessage, sending, pendingQA } = useStore();
  const [text, setText] = useState('');
  const locked = !!pendingQA;

  const handleSend = () => {
    const t = text.trim();
    if (!t || sending || locked) return;
    sendMessage(t);
    setText('');
  };

  return (
    <div className="px-4 pb-4 pt-1 shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className={`rounded-2xl border bg-white shadow-sm transition-colors ${locked ? 'border-slate-200 opacity-70' : 'border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100'}`}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={locked}
            rows={2}
            placeholder={locked ? '输入框已锁定，请在上方回答需求澄清问题' : '输入消息，Enter 发送，Shift+Enter 换行。可直接描述您的开发需求…'}
            className="w-full px-4 pt-3 pb-1 text-[14px] outline-none resize-none disabled:bg-slate-50 rounded-2xl"
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="text-[11px] text-slate-300">
              {locked ? '🔒 二次问答交互中' : '支持多 Agent 协作 · 需求澄清 · 代码生成'}
            </div>
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending || locked}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                text.trim() && !sending && !locked
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {sending ? (
                <>
                  <span className="w-3 h-3 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                  生成中…
                </>
              ) : (
                <><IconSend size={13} /> 发送</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
