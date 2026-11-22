// 金额一律用整数“分”，只在输入和显示时与“元”字符串互转，不做浮点运算
const YUAN_RE = /^(\d{1,9})(?:\.(\d{0,2}))?$/

/** '12.5' → 1250；不合法（负数、超过两位小数、空）返回 null */
export function parseYuan(input: string): number | null {
  const m = YUAN_RE.exec(input.trim())
  if (!m) return null
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
}

/**
 * 显示用金额（不带符号和 ¥）：整数不显示小数，否则去掉末尾的 0。
 * 1234500 → '12,345'，1234550 → '12,345.5'，302 → '3.02'
 */
export function formatPlain(cents: number): string {
  const abs = Math.abs(Math.round(cents))
  const yuan = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fen = abs % 100
  if (fen === 0) return yuan
  return `${yuan}.${String(fen).padStart(2, '0').replace(/0$/, '')}`
}

/** -1250 → '-12.5'（不带 ¥，负数带 '-'；列表、统计里的金额） */
export const formatSigned = (cents: number) => `${cents < 0 ? '-' : ''}${formatPlain(cents)}`

/** -1250 → '-¥12.5'；sign=true 时正数带 '+' */
export function formatYuan(cents: number, sign = false): string {
  const prefix = cents < 0 ? '-' : sign && cents > 0 ? '+' : ''
  return `${prefix}¥${formatPlain(cents)}`
}

/** 编辑时回填输入框：1250 → '12.5'，1200 → '12' */
export function centsToInput(cents: number): string {
  const yuan = Math.floor(cents / 100)
  const fen = cents % 100
  if (fen === 0) return String(yuan)
  return `${yuan}.${String(fen).padStart(2, '0').replace(/0$/, '')}`
}

/** 占比：part / total 的百分数。有但不到 1% 写“<1%”（四舍五入成“0%”像是没花）；total 为 0 时空串 */
export function formatShare(part: number, total: number): string {
  if (total <= 0) return ''
  const p = (part / total) * 100
  if (part > 0 && p < 1) return '<1%'
  return `${Math.round(p)}%`
}
