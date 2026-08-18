import { useState } from 'react';
import { useStore } from '../store';
import { IconSend, IconClose, IconSpark } from './Icons';

// ============================================================
// 智能二次需求问答交互模块
// 后端 AI 响应携带结构化字段 {question, option, or} 时触发：
// - question: 置顶展示提问文本
// - option: 渲染为可点击选项
// - or: 支持自定义输入兜底
// 用户确认后通过专属发送按钮回传后端，实现需求闭环
// ============================================================

export default function SecondaryQA() {
  const { pendingQA, setPendingQAAnswer, selectQaOption, submitQA, clearPendingQA, sending } = useStore();
  const [customMode, setCustomMode] = useState(false);
  const [draft, setDraft] = useState('');

  if (!pendingQA) return null;
  const { qa } = pendingQA;
  const hasOptions = qa.option?.length > 0;
  const allowCustom = qa.or !== undefined && qa.or !== null;

  const effectiveAnswer = customMode ? draft : (pendingQA.answer || '');
  const canSend = effectiveAnswer.trim().length > 0 && !sending;

  const handleSend = () => {
    if (!canSend) return;
    submitQA(effectiveAnswer.trim());
    setCustomMode(false);
    setDraft('');
  };

  const enterCustom = () => {
    setCustomMode(true);
    setDraft('');
    setPendingQAAnswer('');
  };

  return (
    <div className="px-4 pb-2 shrink-0 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white shadow-sm overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-amber-100/70 border-b border-amber-200">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-700">
              <IconSpark size={13} />
              需求澄清 · 需要您补充确认
              <span className="text-[10px] font-normal text-amber-500 ml-1">（输入框已锁定，请在此回答）</span>
            </div>
            <button onClick={clearPendingQA} className="p-1 rounded hover:bg-amber-200 text-amber-500 hover:text-amber-700 transition-colors" title="取消本次提问">
              <IconClose size={13} />
            </button>
          </div>

          {/* 问题 */}
          <div className="px-4 pt-3">
            <div className="text-[14px] font-medium text-slate-800 leading-relaxed">
              {qa.question}
            </div>
            {qa.dimension && (
              <div className="mt-1.5">
                <span className="text-[10px] px-1.5 py-px rounded-full bg-indigo-50 text-indigo-500 border border-indigo-100">维度：{qa.dimension}</span>
              </div>
            )}
          </div>

          {/* 选项 */}
          <div className="px-4 pt-3 flex flex-wrap gap-2">
            {hasOptions && !customMode && qa.option.map((opt, i) => {
              const selected = pendingQA.selectedOption === opt;
              return (
                <button
                  key={i}
                  onClick={() => selectQaOption(opt)}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] border transition-all ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {selected ? '✓ ' : ''}{opt}
                </button>
              );
            })}
            {allowCustom && !customMode && (
              <button
                onClick={enterCustom}
                className="px-3.5 py-1.5 rounded-full text-[13px] border border-dashed border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-all"
              >
                ✎ {qa.or || '其他（自定义输入）'}
              </button>
            )}
          </div>

          {/* 自定义输入 */}
          {customMode && (
            <div className="px-4 pt-3">
              <textarea
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={2}
                placeholder="请输入您的补充说明…"
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-[13px] outline-none focus:ring-2 focus:ring-amber-300 resize-none"
              />
              <div className="flex justify-end gap-2 mt-1.5">
                <button onClick={() => { setCustomMode(false); }} className="text-[12px] px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100">返回选项</button>
              </div>
            </div>
          )}

          {/* 确认发送区 */}
          <div className="px-4 py-3 flex items-center gap-2 border-t border-amber-100 mt-3">
            <div className="flex-1 text-[11px] text-slate-400 truncate">
              {effectiveAnswer
                ? <>回答：<span className="text-amber-600 font-medium">{effectiveAnswer}</span></>
                : '请选择上方选项，或输入自定义内容'}
            </div>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                canSend
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {sending ? '处理中…' : <><IconSend size={13} /> 确认提交</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
