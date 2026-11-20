import { and, gte, lt } from 'drizzle-orm'
import type { WeekReport, YearReport } from '../types/domain'
import { assetCost } from '../utils/assetCost'
import { addDays, today } from '../utils/dates'
import type { Necessity } from '../utils/necessity'
import { longestStreak } from '../utils/streak'
import { listAssets } from './assetRepo'
import { inLedger, type DB } from './core'
import { recordedDays } from './dayRepo'
import { transactions } from './schema'
import { largestExpenseId, monthSummary, rangeSummary } from './statsRepo'
import { getTxnView } from './txnRepo'

/** 盘账“周”视图另外显示的：最大的一笔、这周记了几天。start 是周一 */
export function weekReport(db: DB, ledgerId: string, start: string): WeekReport {
  const largest = largestExpenseId(db, ledgerId, start, addDays(start, 7))
  const days = new Set(recordedDays(db))
  let recordDays = 0
  for (let i = 0; i < 7; i++) if (days.has(addDays(start, i))) recordDays++
  return { largest: (largest && getTxnView(db, largest)) || null, recordDays }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function yearReport(db: DB, ledgerId: string, year: number, now = today(), filter: Necessity | 'all' = 'all'): YearReport {
  const y = String(year)
  const months = Array.from({ length: 12 }, (_, i) => {
    const s = monthSummary(db, ledgerId, `${y}-${pad(i + 1)}`)
    return { month: s.month, incomeCents: s.incomeCents, expenseCents: s.expenseCents }
  })

  let bestAsset: YearReport['bestAsset'] = null
  const added = listAssets(db, ledgerId).filter((a) => a.acquiredOn.startsWith(`${y}-`))
  for (const a of added) {
    const c = assetCost(a, now)
    if (!bestAsset || c.perDayCents < bestAsset.perDayCents) bestAsset = { name: a.name, perDayCents: c.perDayCents, days: c.days }
  }

  const days = [...new Set(recordedDays(db))].filter((d) => d.startsWith(`${y}-`) && d <= now)
  return {
    year,
    summary: rangeSummary(db, ledgerId, `${y}-01-01`, `${year + 1}-01-01`, false, filter),
    months,
    assetsAdded: added.length,
    bestAsset,
    recordDays: days.length,
    longestStreak: longestStreak(days),
  }
}

export function hasTxnsInYear(db: DB, ledgerId: string, year: number) {
  const t = transactions
  return !!db
    .select({ id: t.id })
    .from(t)
    .where(and(inLedger(t, ledgerId), gte(t.date, `${year}-01-01`), lt(t.date, `${year + 1}-01-01`)))
    .get()
}

/** 小组件用：今日、本月已花（退款冲减，买家当也算） */
export function spendSnapshot(db: DB, ledgerId: string, day = today()) {
  return {
    todayCents: Math.max(0, rangeSummary(db, ledgerId, day, addDays(day, 1)).expenseCents),
    monthCents: Math.max(0, monthSummary(db, ledgerId, day.slice(0, 7)).expenseCents),
  }
}
