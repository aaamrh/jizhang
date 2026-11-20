import { daysInclusive } from './dates'

export interface CostInput {
  costCents: number
  soldCents: number | null
  acquiredOn: string
  endedOn: string | null
  useCount: number
}

export interface Cost {
  days: number
  netCents: number // 买价 − 卖价，即实际花掉的钱
  perDayCents: number
  perUseCents: number | null // 次数为 0 时不算
  profitCents: number | null // 卖出才有：卖价 − 买价
}

/** 持有天数含买入当天，结束日是出手日或今天 */
export function assetCost(a: CostInput, today: string): Cost {
  const days = Math.max(1, daysInclusive(a.acquiredOn, a.endedOn ?? today))
  const netCents = a.costCents - (a.soldCents ?? 0)
  return {
    days,
    netCents,
    perDayCents: Math.round(netCents / days),
    perUseCents: a.useCount > 0 ? Math.round(netCents / a.useCount) : null,
    profitCents: a.soldCents === null ? null : a.soldCents - a.costCents,
  }
}

/** “再用 extra 天，日均降到多少” */
export const perDayAfter = (c: Cost, extra = 180) => Math.round(c.netCents / (c.days + extra))
