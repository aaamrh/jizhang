// 记账键盘的算式：只支持 + 和 −；每个数最多 9 位整数、2 位小数。
// 求值用 parseYuan 把每一项转成“分”再加减，不经过浮点运算。
import { parseYuan } from './money'

export type CalcKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '+' | '-' | 'back'

const isOp = (c: string | undefined) => c === '+' || c === '-'
const MAX_INT_DIGITS = 9

/** 按一个键后的新算式；不合法的按键直接忽略 */
export function pressKey(expr: string, key: CalcKey): string {
  if (key === 'back') return expr.slice(0, -1)
  const last = expr.at(-1)
  if (isOp(key)) {
    if (!expr) return expr // 不能以运算符开头
    if (isOp(last) || last === '.') return expr.slice(0, -1) + key // 连按运算符时替换；去掉悬空的小数点
    return expr + key
  }
  const cur = expr.split(/[+-]/).at(-1) ?? ''
  if (key === '.') {
    if (cur.includes('.')) return expr
    return expr + (cur === '' ? '0.' : '.')
  }
  // 数字
  if (cur.includes('.')) return cur.split('.')[1]!.length >= 2 ? expr : expr + key
  if (cur === '0') return expr.slice(0, -1) + key // 去掉前导 0
  if (cur.length >= MAX_INT_DIGITS) return expr
  return expr + key
}

/** 算式里有没有运算（此时“完成”键显示为"="） */
export const hasOperator = (expr: string) => /[+-]/.test(expr.replace(/[+-]$/, ''))

/** 求值，单位“分”；空、不合法返回 null；结果可能 ≤ 0，由调用方判断 */
export function evaluate(expr: string): number | null {
  const s = expr.replace(/[+-]$/, '')
  if (!s) return null
  const re = /([+-]?)([^+-]+)/g
  let total = 0
  let consumed = 0
  for (const m of s.matchAll(re)) {
    if (m.index !== consumed) return null
    consumed += m[0].length
    const cents = parseYuan(m[2]!)
    if (cents === null) return null
    total += m[1] === '-' ? -cents : cents
  }
  return consumed === s.length ? total : null
}
