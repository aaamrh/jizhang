import { describe, expect, it } from 'vitest'
import { feedByDay, feedCategories, feedSummary, type FeedItem } from './familyFeed'

const item = (id: string, date: string, type: FeedItem['type'], amountCents: number, cat: string | null, userId = 'u1', createdAt = 0): FeedItem => ({
  id,
  date,
  type,
  amountCents,
  note: '',
  review: null,
  createdAt,
  userId,
  category: cat ? { name: cat, icon: 'retro:veg-basket', color: 'songlv', tier: 'need' } : null,
})

const items = [
  item('a', '2026-11-18', 'expense', 3600, '买菜', 'u1', 1),
  item('b', '2026-11-18', 'expense', 1000, '买菜', 'u2', 2),
  item('c', '2026-11-17', 'refund', 600, '买菜', 'u2'),
  item('d', '2026-11-17', 'income', 800000, '工资', 'u1'),
  item('e', '2026-11-16', 'expense', 5000, '外出就餐', 'u2'),
]

describe('家庭账本汇总', () => {
  it('支出扣掉退款，结余 = 收入 − 支出', () => {
    expect(feedSummary(items)).toEqual({ expenseCents: 9000, incomeCents: 800000, balanceCents: 791000 })
  })
  it('按天分组：新的在前，同一天后记的在前', () => {
    const g = feedByDay(items, '2026-11-18')
    expect(g.map((x) => x.label)).toEqual(['今天', '昨天', g[2]!.label])
    expect(g[0]!.items.map((t) => t.id)).toEqual(['b', 'a'])
    expect(g[1]!.expenseCents).toBe(-600)
    expect(g[1]!.incomeCents).toBe(800000)
  })
  it('各人的分类按名字合到一起，收入不算，从大到小', () => {
    expect(feedCategories(items).map((c) => [c.name, c.cents])).toEqual([
      ['外出就餐', 5000],
      ['买菜', 4000],
    ])
  })
})
