// 家庭账本的汇总：服务器把一家人各自账本里、各自共享开始日期起记的账汇到一起（见 docs/需求.md 第 11 节），这里只做纯计算
import { dayLabel, today } from './dates'

/** 服务器 GET /api/ledgers/:id/family-feed 返回的一笔账（转账不汇，所以只有支出、收入、退款） */
export interface FeedItem {
  id: string
  date: string
  type: 'expense' | 'income' | 'refund'
  amountCents: number
  note: string
  review: string | null
  createdAt: number
  /** 谁记的（他自己账本的主人） */
  userId: string | null
  category: { name: string; icon: string; color: string; tier: string | null } | null
}

export interface FamilyFeed {
  /** 创建者的大掌柜有效 */
  active: boolean
  /** 过期时：到期那天（家人这天之后记的账暂时不汇进来） */
  frozenSince: string | null
  items: FeedItem[]
}

/** 支出 = 支出 − 退款；结余 = 收入 − 支出 */
export function feedSummary(items: FeedItem[]) {
  let expenseCents = 0
  let incomeCents = 0
  for (const t of items) {
    if (t.type === 'expense') expenseCents += t.amountCents
    else if (t.type === 'refund') expenseCents -= t.amountCents
    else incomeCents += t.amountCents
  }
  return { expenseCents, incomeCents, balanceCents: incomeCents - expenseCents }
}

/** 按天分组，新的在前；每组的支出、收入合计（退款冲减支出） */
export function feedByDay<T extends FeedItem>(items: T[], now = today()) {
  const groups: { date: string; label: string; expenseCents: number; incomeCents: number; items: T[] }[] = []
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  for (const t of sorted) {
    let g = groups[groups.length - 1]
    if (!g || g.date !== t.date) {
      g = { date: t.date, label: dayLabel(t.date, now), expenseCents: 0, incomeCents: 0, items: [] }
      groups.push(g)
    }
    g.items.push(t)
    if (t.type === 'expense') g.expenseCents += t.amountCents
    else if (t.type === 'refund') g.expenseCents -= t.amountCents
    else g.incomeCents += t.amountCents
  }
  return groups
}

/** 支出按分类名合计（各人的分类按名字合到一起，退款冲减），从大到小，只留大于 0 的 */
export function feedCategories(items: FeedItem[]) {
  const acc = new Map<string, { name: string; icon: string; color: string; cents: number }>()
  for (const t of items) {
    if (t.type === 'income') continue
    const name = t.category?.name ?? '未分类'
    const cur = acc.get(name) ?? { name, icon: t.category?.icon ?? '', color: t.category?.color ?? 'mo', cents: 0 }
    cur.cents += (t.type === 'expense' ? 1 : -1) * t.amountCents
    acc.set(name, cur)
  }
  return [...acc.values()].filter((c) => c.cents > 0).sort((a, b) => b.cents - a.cents)
}
