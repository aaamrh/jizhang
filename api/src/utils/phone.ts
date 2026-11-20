// shortcut: 只支持中国大陆 11 位手机号；要支持海外号码时再引入 libphonenumber
export const PHONE_RE = /^1[3-9]\d{9}$/

export const maskPhone = (p: string) => `${p.slice(0, 3)}****${p.slice(7)}`
