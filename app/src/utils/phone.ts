// shortcut: 只支持中国大陆 11 位手机号（和服务器一致）
export const isPhone = (s: string) => /^1[3-9]\d{9}$/.test(s.trim())

export const isSmsCode = (s: string) => /^\d{6}$/.test(s.trim())
