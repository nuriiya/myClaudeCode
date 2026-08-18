import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { STAGE_LABEL } from '../types';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import SecondaryQA from './SecondaryQA';
import { IconPanelRight, IconRobot } from './Icons';

export default function ChatArea() {
  const { activeTopicId, topics, messages, loadingMessages, projectMeta, projectPanelOpen, openProjectPanel, loadProjectMeta } = useStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const topic = topics.find(t => t.id === activeTopicId) || null;
  const stage = STAGE_LABEL[topic?.stage || 'chat'] || STAGE_LABEL.chat;

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  if (!topic) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-slate-50">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg mb-4">
          <IconRobot size={30} />
        </div>
        <div className="text-lg font-semibold text-slate-700">欢迎使用 AI 协作工坊</div>
        <div className="text-[13px] text-slate-400 mt-1 max-w-sm text-center leading-relaxed">
          新建对话主题，描述您的开发需求<br />
          多 Agent 将协同完成：需求澄清 → 需求文档 → 代码生成
        </div>
        <div className="mt-6 flex gap-2">
          {['💬 日常对话', '📋 需求澄清', '⚙️ 代码生成'].map((s, i) => (
            <span key={i} className="text-[12px] px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-500">{s}</span>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-w-0">
      {/* 顶栏 */}
      <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-[15px] font-semibold text-slate-800 truncate">{topic.title}</div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${stage.cls}`}>{stage.text}</span>
          {topic.kind === 'project' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-500 shrink-0">📦 项目主题</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {topic.kind === 'project' && (
            <button
              onClick={async () => { await loadProjectMeta(); openProjectPanel(); }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${
                projectPanelOpen
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <IconPanelRight size={13} /> 项目文件
              {projectMeta?.folderMeta ? `（${projectMeta.folderMeta.fileCount}）` : ''}
            </button>
          )}
        </div>
      </header>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {loadingMessages ? (
            <div className="text-center text-[13px] text-slate-400 py-10">加载对话记录…</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-14">
              <div className="text-[14px] text-slate-500 mb-1">开始新的对话</div>
              <div className="text-[12px] text-slate-400 max-w-md mx-auto leading-relaxed">
                直接描述您的开发需求，例如：<br />
                「帮我开发一个个人博客网站，支持文章发布和评论」
              </div>
            </div>
          ) : (
            messages.map(m => <MessageBubble key={m.id} msg={m} />)
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 二次问答模块（锁定输入框） */}
      <SecondaryQA />

      {/* 输入框 */}
      <ChatInput />
    </main>
  );
}
