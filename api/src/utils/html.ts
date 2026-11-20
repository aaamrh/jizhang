const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** 拼进 HTML 的用户内容（账本名、昵称）必须先转义 */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => MAP[c]!)
