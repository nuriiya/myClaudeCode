// 轻量内联 SVG 图标集
interface IconProps { size?: number; className?: string }

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const IconPlus = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);

export const IconTrash = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" /></svg>
);

export const IconEdit = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
);

export const IconSend = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
);

export const IconSettings = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const IconFolder = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
);

export const IconDoc = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
);

export const IconFile = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
);

export const IconCode = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>
);

export const IconClose = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M18 6 6 18M6 6l12 12" /></svg>
);

export const IconRefresh = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
);

export const IconKey = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
);

export const IconRobot = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><circle cx="9" cy="15" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><path d="M12 3v2" /></svg>
);

export const IconPanelRight = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></svg>
);

export const IconSpark = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>
);
