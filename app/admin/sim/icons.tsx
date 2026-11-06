// Simple line icons (own drawings, not Instagram assets).
const s = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const Back = () => (<svg className="icon" viewBox="0 0 24 24" {...s}><path d="M15 5l-7 7 7 7" /></svg>);
export const Phone = () => (<svg className="icon" viewBox="0 0 24 24" {...s}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z" /></svg>);
export const Video = () => (<svg className="icon" viewBox="0 0 24 24" {...s}><rect x="3" y="6" width="13" height="12" rx="3" /><path d="M16 10l5-3v10l-5-3" /></svg>);
export const Camera = () => (<svg width="18" height="18" viewBox="0 0 24 24" {...s}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>);
export const Heart = () => (<svg className="icon" viewBox="0 0 24 24" {...s}><path d="M12 20s-7-4.5-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.5-9 9-9 9z" /></svg>);
export const Comment = () => (<svg className="icon" viewBox="0 0 24 24" {...s}><path d="M21 12a8.5 8.5 0 01-12.5 7.5L3 21l1.5-5.5A8.5 8.5 0 1121 12z" /></svg>);
export const Send = () => (<svg className="icon" viewBox="0 0 24 24" {...s}><path d="M22 3L11 13" /><path d="M22 3l-7 18-4-8-8-4z" /></svg>);
export const Bookmark = () => (<svg className="icon" viewBox="0 0 24 24" {...s}><path d="M6 3h12v18l-6-5-6 5z" /></svg>);
export const Person = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0z" /></svg>);
export const More = () => (<svg className="icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>);
