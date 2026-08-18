import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true
});

export function renderMarkdown(src: string): string {
  try {
    return marked.parse(src || '') as string;
  } catch {
    return `<p>${String(src || '').replace(/</g, '&lt;')}</p>`;
  }
}

// 简单文本截断
export function truncate(s: string, n = 100): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}
