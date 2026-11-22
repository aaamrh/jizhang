// 日期一律是本地时区的 'YYYY-MM-DD' 字符串，月份是 'YYYY-MM'
const DAY_MS = 86_400_000
const WEEK = ['日', '一', '二', '三', '四', '五', '六']

const pad = (n: number) => String(n).padStart(2, '0')

export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = () => toDateStr(new Date())

const parts = (s: string) => s.split('-').map(Number) as [number, number, number]

/** 'YYYY-MM-DD' → 本地 Date（零点） */
export const fromDateStr = (s: string) => {
  const [y, m, d] = parts(s)
  return new Date(y, m - 1, d)
}

const utc = (s: string) => {
  const [y, m, d] = parts(s)
  return Date.UTC(y, m - 1, d)
}

/** 含首尾的天数：同一天 = 1 */
export const daysInclusive = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY_MS) + 1

export const addDays = (s: string, n: number) => {
  const d = new Date(utc(s) + n * DAY_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const monthOf = (s: string) => s.slice(0, 7)

export const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`
}

/** 用于 SQL 区间查询：[start, end) */
export const monthRange = (month: string) => ({ start: `${month}-01`, end: `${shiftMonth(month, 1)}-01` })

export const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return `${y}年${m}月`
}

/** '2026-11-17' → '11月17日 周二'，今天/昨天用口语 */
export function dayLabel(s: string, now = today()) {
  if (s === now) return '今天'
  if (s === addDays(now, -1)) return '昨天'
  const [, m, d] = parts(s)
  return `${m}月${d}日 周${WEEK[new Date(utc(s)).getUTCDay()]}`
}

export const dayOfYear = (s: string) => daysInclusive(`${s.slice(0, 4)}-01-01`, s)

/** 所在周的周一（周报按周一到周日） */
export const weekStartOf = (s: string) => addDays(s, -((new Date(utc(s)).getUTCDay() + 6) % 7))

/** '2026-11-16' → '11月16日 – 11月22日' */
export function weekLabel(start: string) {
  const md = (x: string) => {
    const [, m, d] = parts(x)
    return `${m}月${d}日`
  }
  return `${md(start)} – ${md(addDays(start, 6))}`
}

/** 这个月还剩几天（含今天）；过去的月份为 0，未来的月份为整月天数 */
export function daysLeftInMonth(month: string, now = today()) {
  const { start, end } = monthRange(month)
  if (now >= end) return 0
  return daysInclusive(now < start ? start : now, addDays(end, -1))
}

export type PeriodKind = 'week' | 'month' | 'year'

/** 统计页的时间段 [start, end)：anchor 是该段里任意一天 */
export function periodRange(kind: PeriodKind, anchor: string) {
  if (kind === 'week') {
    const start = weekStartOf(anchor)
    return { start, end: addDays(start, 7) }
  }
  if (kind === 'month') return monthRange(monthOf(anchor))
  const y = Number(anchor.slice(0, 4))
  return { start: `${y}-01-01`, end: `${y + 1}-01-01` }
}

/** 前后移动一个时间段，返回新段的第一天 */
export function shiftPeriod(kind: PeriodKind, anchor: string, n: number) {
  const { start } = periodRange(kind, anchor)
  if (kind === 'week') return addDays(start, 7 * n)
  if (kind === 'month') return `${shiftMonth(monthOf(start), n)}-01`
  return `${Number(start.slice(0, 4)) + n}-01-01`
}

/** 时间段标题：本周 / 11月16日 – 11月22日、2026年11月、2026年 */
export function periodLabel(kind: PeriodKind, anchor: string, now = today()) {
  const { start } = periodRange(kind, anchor)
  if (kind === 'week') return start === weekStartOf(now) ? '本周' : weekLabel(start)
  if (kind === 'month') return monthLabel(monthOf(start))
  return `${start.slice(0, 4)}年`
}

/** 盘账左上角的时间段，分小字、大字两行（和流水左上角的“2026年 / 11月”一个样子）
 *  月：2026年 / 11月；年：全年 / 2026年；周：2026年11月 · 本周 / 16–22日，跨月写 2026年 / 10.27–11.2 */
export function periodBlockText(kind: PeriodKind, anchor: string, now = today()) {
  const { start } = periodRange(kind, anchor)
  const y = start.slice(0, 4)
  const m = Number(start.slice(5, 7))
  if (kind === 'year') return { small: '全年', big: `${y}年` }
  if (kind === 'month') return { small: `${y}年`, big: `${m}月` }
  const end = addDays(start, 6)
  const m2 = Number(end.slice(5, 7))
  const d1 = Number(start.slice(8, 10))
  const d2 = Number(end.slice(8, 10))
  const thisWeek = start === weekStartOf(now) ? ' · 本周' : ''
  return m === m2 ? { small: `${y}年${m}月${thisWeek}`, big: `${d1}–${d2}日` } : { small: `${y}年${thisWeek}`, big: `${m}.${d1}–${m2}.${d2}` }
}

/**
 * 选日子面板的格子：固定 6 行 42 天，从 1 号所在那周的周一排起；前后月的日子也排上（界面上画成灰色），
 * 第一行不会是“空空空空空空 1”（用户要的），选周时跨月的那周也是完整的一行。inMonth：是不是这个月的
 */
export function pickerGrid(month: string): { date: string; inMonth: boolean }[] {
  const start = weekStartOf(`${month}-01`)
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i)
    return { date, inMonth: date.slice(0, 7) === month }
  })
}

/** 月历格子：周一开头，按周排成 7 列；不属于本月的位置是 null */
export function monthGrid(month: string): (string | null)[] {
  const first = `${month}-01`
  const lead = (fromDateStr(first).getDay() + 6) % 7 // 周一 = 0
  const days = daysInclusive(first, addDays(`${shiftMonth(month, 1)}-01`, -1))
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let i = 0; i < days; i++) cells.push(addDays(first, i))
  while (cells.length % 7) cells.push(null)
  return cells
}
