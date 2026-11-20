/** 版本号格式：1、1.2、1.2.3 */
export const VERSION_RE = /^\d{1,4}(\.\d{1,4}){0,2}$/

/** 按数字逐段比较：a<b 返回负数，相等 0，a>b 正数。缺的段当 0（1.2 == 1.2.0） */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}
