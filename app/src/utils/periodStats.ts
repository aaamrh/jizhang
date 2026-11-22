import { addDays, daysInclusive, monthRange, periodRange, shiftPeriod, today, type PeriodKind } from './dates'
import { formatYuan } from './money'

/** 某一天（或某个月）的净支出：支出 − 退款 */
export interface DaySpend {
  date: string
  cents: number
}

/**
 * 同期：这一段到今天为止 [start, curEnd)，和上一段从头数同样多天 [prevStart, prevEnd)。
 * 没过完的周 / 月 / 年拿“到今天”去比上一段“同样多天”，不拿半段比整段；
 * 上一段短（3 月 31 号比 2 月）就比到它月底。complete：这一段已经过完
 */
export function samePeriod(kind: PeriodKind, anchor: string, now = today()) {
  const { start, end } = periodRange(kind, anchor)
  const tomorrow = addDays(now, 1)
  const curEnd = tomorrow < end ? tomorrow : end
  const days = Math.max(1, daysInclusive(start, addDays(curEnd, -1)))
  const prevStart = shiftPeriod(kind, anchor, -1)
  const prevFull = periodRange(kind, prevStart)
  const cand = addDays(prevStart, days)
  return {
    cur: { start, end: curEnd },
    prev: { start: prevStart, end: cand < prevFull.end ? cand : prevFull.end },
    prevFull,
    days,
    complete: curEnd === end,
  }
}

/** rows 里日期早于 before（不含）的合计；不给 before 就是全部 */
export function sumSpend(rows: DaySpend[], before?: string) {
  let n = 0
  for (const r of rows) if (!before || r.date < before) n += r.cents
  return n
}

/** 家庭账本的账（服务器给的）按天合成净支出，收入不算 */
export function feedDailySpend(items: { date: string; type: 'expense' | 'income' | 'refund'; amountCents: number }[]): DaySpend[] {
  const m = new Map<string, number>()
  for (const t of items) {
    if (t.type === 'income') continue
    m.set(t.date, (m.get(t.date) ?? 0) + (t.type === 'expense' ? t.amountCents : -t.amountCents))
  }
  return [...m.entries()].map(([date, cents]) => ({ date, cents }))
}

const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日']

export interface SpendBucket {
  key: string
  /** 横轴上的字；null 不写（一个月 30 根柱子只写 1、5、10……和月底） */
  axis: string | null
  /** 点开明细用的日期段 [start, end) */
  start: string
  end: string
  cents: number
  /** 还没到的日子：留位置不画柱子，月份的样子是完整的 */
  future: boolean
  /** 读屏和明细标题：11月20日、11月 */
  name: string
}

/** 柱状图的柱子：周、月每天一根，年每月一根 */
export function spendBuckets(kind: PeriodKind, anchor: string, rows: DaySpend[], now = today()): SpendBucket[] {
  const { start, end } = periodRange(kind, anchor)
  if (kind === 'year') {
    const y = start.slice(0, 4)
    return Array.from({ length: 12 }, (_, i) => {
      const month = `${y}-${String(i + 1).padStart(2, '0')}`
      const r = monthRange(month)
      return {
        key: month,
        axis: String(i + 1),
        start: r.start,
        end: r.end,
        cents: rows.reduce((a, x) => (x.date >= r.start && x.date < r.end ? a + x.cents : a), 0),
        future: r.start > now,
        name: `${i + 1}月`,
      }
    })
  }
  const byDay = new Map<string, number>()
  for (const r of rows) byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.cents)
  const n = daysInclusive(start, addDays(end, -1))
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(start, i)
    const day = Number(d.slice(8, 10))
    const axis = kind === 'week' ? WEEKDAY[i]! : day === 1 || day % 5 === 0 ? (i === n - 2 ? null : String(day)) : i === n - 1 ? String(day) : null
    return { key: d, axis, start: d, end: addDays(d, 1), cents: byDay.get(d) ?? 0, future: d > now, name: `${Number(d.slice(5, 7))}月${day}日` }
  })
}

/** 上一段的日均（年是月均），柱状图上那道虚线 */
export function prevAverage(kind: PeriodKind, prevFull: { start: string; end: string }, prevCents: number) {
  const n = kind === 'year' ? 12 : daysInclusive(prevFull.start, addDays(prevFull.end, -1))
  return Math.round(prevCents / n)
}

const PREV_NAME: Record<PeriodKind, string> = { week: '上周', month: '上月', year: '去年' }

/**
 * 和上一段比：只陈述，不评判。“比上月同期多花 ¥2,310”；过完了的段不写“同期”。
 * what：筛了必要性时写在前面（“非必要比上月同期少花……”）。上一段同期没花钱就不比（没有参照）
 */
export function compareText(kind: PeriodKind, cur: number, prev: number, complete: boolean, what = '') {
  if (prev <= 0) return null
  const base = `${PREV_NAME[kind]}${complete ? '' : '同期'}`
  const d = cur - prev
  if (d === 0) return `${what}和${base}持平`
  return d < 0 ? `${what}比${base}少花 ${formatYuan(-d)}` : `${what}比${base}多花 ${formatYuan(d)}`
}

/** 虚线旁边的字：上月日均 ¥85、去年月均 ¥3,200 */
export const averageLabel = (kind: PeriodKind) => `${PREV_NAME[kind]}${kind === 'year' ? '月均' : '日均'}`
