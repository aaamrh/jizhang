/**
 * 周期记账的日子怎么算（纯函数）。从 startDate（含）起，按 freq 记在选定的日子：
 * 每天 / 每周几 / 每月几号（没有这一号的月份记在月底，如 31 号到了 2 月记 28 或 29 号）/ 每年几月几号（2 月 29 日平年记 28 日）。
 * day、month 不填就跟 startDate 同一天（同星期几、同号、同月同日）
 */
import { addDays } from './dates'

export type Freq = 'day' | 'week' | 'month' | 'year'
export const FREQS: Freq[] = ['day', 'week', 'month', 'year']

export interface RecurringRule {
  freq: Freq
  startDate: string
  endDate: string | null
  /** 每周：周几（1 = 周一 … 7 = 周日）；每月、每年：几号（1–31）。null 跟 startDate */
  day?: number | null
  /** 每年：几月（1–12）。null 跟 startDate */
  month?: number | null
}

/** 选哪天重复：只有 freq、day、month */
export type Repeat = { freq: Freq; day: number | null; month: number | null }

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const pad = (n: number) => String(n).padStart(2, '0')
const parts = (s: string) => s.split('-').map(Number) as [number, number, number]
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** 星期几：1 = 周一 … 7 = 周日 */
export const isoWeekday = (s: string) => {
  const [y, m, d] = parts(s)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7
}

/** 实际用的周几 / 几号 / 几月（没填的取开始日期的） */
export function anchorOf(r: Pick<RecurringRule, 'freq' | 'startDate' | 'day' | 'month'>) {
  const [, m, d] = parts(r.startDate)
  return { day: r.day ?? (r.freq === 'week' ? isoWeekday(r.startDate) : d), month: r.month ?? m }
}

/** 第 i 次（从 0 起）的日子：第 0 次是开始日（含）之后第一个对得上的日子 */
export function nthDate(r: Pick<RecurringRule, 'freq' | 'startDate' | 'day' | 'month'>, i: number): string {
  if (r.freq === 'day') return addDays(r.startDate, i)
  const a = anchorOf(r)
  if (r.freq === 'week') return addDays(r.startDate, ((a.day - isoWeekday(r.startDate) + 7) % 7) + i * 7)
  const y0 = Number(r.startDate.slice(0, 4))
  // total：从 y0 年 1 月算起的第几个月
  const at = (total: number) => {
    const y = y0 + Math.floor(total / 12)
    const m = (total % 12) + 1
    return `${y}-${pad(m)}-${pad(Math.min(a.day, daysInMonth(y, m)))}`
  }
  const step = r.freq === 'month' ? 1 : 12
  let first = r.freq === 'month' ? Number(r.startDate.slice(5, 7)) - 1 : a.month - 1
  if (at(first) < r.startDate) first += step
  return at(first + i * step)
}

/** [from, to] 之间（含首尾、不超过 endDate）该记的日子，从早到晚；最多 limit 个 */
export function occurrences(r: RecurringRule, from: string, to: string, limit = 1000): string[] {
  const last = r.endDate && r.endDate < to ? r.endDate : to
  const out: string[] = []
  // 跳过 from 之前的：按天、周直接算出起点，按月、年逐个数（一年最多 12 个，很快）
  let i = 0
  if (from > r.startDate && (r.freq === 'day' || r.freq === 'week')) {
    const days = Math.round((Date.parse(from) - Date.parse(r.startDate)) / 86_400_000)
    i = Math.max(0, Math.floor(days / (r.freq === 'day' ? 1 : 7)))
  }
  for (; out.length < limit; i++) {
    const d = nthDate(r, i)
    if (d > last) break
    if (d >= from) out.push(d)
  }
  return out
}

/** date 所在的这一期的最后一天（这天 / 这周日 / 这月底 / 这年底）：从一笔账设成周期时，这一期算记过了 */
export function periodEnd(freq: Freq, date: string): string {
  const [y, m] = parts(date)
  if (freq === 'day') return date
  if (freq === 'week') return addDays(date, 7 - isoWeekday(date))
  if (freq === 'month') return `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`
  return `${y}-12-31`
}

/** 晚于 after 的下一次；已经结束返回 null */
export const nextDate = (r: RecurringRule, after: string) => occurrences(r, addDays(after, 1), '9999-12-31', 1)[0] ?? null

/** “每月 15 日”这样的一句话 */
export function freqLabel(r: Pick<RecurringRule, 'freq' | 'startDate' | 'day' | 'month'>): string {
  const a = anchorOf(r)
  if (r.freq === 'day') return '每天'
  if (r.freq === 'week') return `每周${WEEK[a.day % 7]}`
  if (r.freq === 'month') return `每月 ${a.day} 日`
  return `每年 ${a.month} 月 ${a.day} 日`
}
