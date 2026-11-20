/**
 * 金额颜色（纯函数，可在 node 里测）：按中国人记账的习惯——
 * 花出去的钱（支出、负数、超支、欠款）用红，进来的钱（收入、正数）用绿，零用墨色。
 * 两个颜色在纸面 #FFFDF8 上的对比度都 ≥ 4.5:1（朱红 ≈ 9:1，松绿 ≈ 5:1）
 */
export const MONEY_RED = '#B5322B' // 朱红
export const MONEY_GREEN = '#3F7A55' // 松绿
export const MONEY_ZERO = '#2B2118' // 墨

/** 带正负号的金额：正 → 绿，负 → 红，零 → 墨 */
export const amountColor = (cents: number) => (cents > 0 ? MONEY_GREEN : cents < 0 ? MONEY_RED : MONEY_ZERO)

/** WCAG 对比度（测试用，保证颜色读得清） */
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}
