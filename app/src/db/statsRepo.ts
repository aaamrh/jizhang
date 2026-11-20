import { and, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { toCategory } from '../mapper/category'
import type { CategoryAmount, MonthSummary, PeriodSummary } from '../types/domain'
import { monthRange } from '../utils/dates'
import { legacyReview, NECESSITIES, necessityOf, type Necessity } from '../utils/necessity'
import { inLedger, type DB } from './core'
import { categories, transactions as t } from './schema'

/**
 * 一段日期 [start, end) 的汇总。
 * - 支出 = 支出 − 退款/报销（按分类冲减）
 * - excludeAssets：去掉买家当的支出（关联了家当的支出），只看日常消费
 * - filter：只算某一种必要性的支出（复盘标记优先，没标记按分类档位推定）；收入不受影响
 */
export function rangeSummary(
  db: DB,
  ledgerId: string,
  start: string,
  end: string,
  excludeAssets = false,
  filter: Necessity | 'all' = 'all',
): PeriodSummary {
  const inRange = and(inLedger(t, ledgerId), gte(t.date, start), lt(t.date, end))

  const rows = db
    .select({ categoryId: t.categoryId, type: t.type, review: t.review, cents: sql<number>`sum(${t.amountCents})` })
    .from(t)
    .where(and(inRange, excludeAssets ? sql`not (${t.type} = 'expense' and ${t.assetId} is not null)` : undefined))
    .groupBy(t.categoryId, t.type, t.review)
    .all()

  // 已合并或删除的分类也要能显示名字，所以不过滤 deletedAt
  const cats = new Map(
    db.select().from(categories).where(eq(categories.ledgerId, ledgerId)).all().map((r) => [r.id, toCategory(r)]),
  )

  let incomeCents = 0
  const net = new Map<string, number>()
  const necessity: Record<Necessity, number> = { necessary: 0, unnecessary: 0, pending: 0 }
  for (const r of rows) {
    const n = Number(r.cents ?? 0)
    if (r.type === 'income') incomeCents += n
    else if ((r.type === 'expense' || r.type === 'refund') && r.categoryId) {
      const signed = r.type === 'expense' ? n : -n
      const kind = necessityOf(legacyReview(r.review), cats.get(r.categoryId)?.tier ?? null)
      necessity[kind] += signed
      if (filter !== 'all' && kind !== filter) continue
      net.set(r.categoryId, (net.get(r.categoryId) ?? 0) + signed)
    }
  }
  for (const k of NECESSITIES) necessity[k] = Math.max(0, necessity[k])

  const list: CategoryAmount[] = []
  let expenseCents = 0
  for (const [id, cents] of net) {
    expenseCents += cents
    const c = cats.get(id)
    if (!c || cents <= 0) continue
    list.push({ categoryId: id, name: c.name, icon: c.icon, color: c.color, tier: c.tier, cents })
  }
  list.sort((a, b) => b.cents - a.cents)

  const txnCount = db.select({ n: count() }).from(t).where(inRange).get()?.n ?? 0

  const reviewed =
    db
      .select({ n: count() })
      .from(t)
      .innerJoin(categories, eq(categories.id, t.categoryId))
      .where(and(inRange, eq(t.type, 'expense'), inArray(categories.tier, ['flex', 'want']), inArray(t.review, ['necessary', 'unnecessary'])))
      .get()?.n ?? 0

  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents, txnCount, necessity, categories: list, reviewed }
}

export function monthSummary(db: DB, ledgerId: string, month: string, excludeAssets = false, filter: Necessity | 'all' = 'all'): MonthSummary {
  const { start, end } = monthRange(month)
  return { month, ...rangeSummary(db, ledgerId, start, end, excludeAssets, filter) }
}

/** 一段日期内金额最大的一笔支出的 id */
export function largestExpenseId(db: DB, ledgerId: string, start: string, end: string): string | undefined {
  return db
    .select({ id: t.id })
    .from(t)
    .where(and(inLedger(t, ledgerId), eq(t.type, 'expense'), gte(t.date, start), lt(t.date, end)))
    .orderBy(desc(t.amountCents), desc(t.createdAt))
    .get()?.id
}
