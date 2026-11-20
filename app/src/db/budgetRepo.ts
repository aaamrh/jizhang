import { and, eq, isNull } from 'drizzle-orm'
import { toBudget } from '../mapper/budget'
import type { Budget, BudgetLine, BudgetStatus } from '../types/domain'
import { budgetProgress } from '../utils/budget'
import { daysLeftInMonth, today } from '../utils/dates'
import { DomainError, inLedger, removed, touched, type DB } from './core'
import { budgets, categories } from './schema'
import { defaultId } from './seed'
import { monthSummary } from './statsRepo'
import { listCategories } from './categoryRepo'

/** 预算 id 由账本和分类决定：多台手机设置同一条预算不会重复 */
export const budgetId = (ledgerId: string, categoryId: string | null) => defaultId(ledgerId, `budget:${categoryId ?? 'total'}`)

export function listBudgets(db: DB, ledgerId: string): Budget[] {
  return db
    .select()
    .from(budgets)
    .where(inLedger(budgets, ledgerId))
    .all()
    .map(toBudget)
    .filter((b) => b.amountCents > 0)
}

/** 设置一条预算；金额为 0 或 null 表示取消 */
export function setBudget(db: DB, ledgerId: string, categoryId: string | null, amountCents: number | null) {
  if (amountCents !== null && (!Number.isInteger(amountCents) || amountCents < 0)) throw new DomainError('预算金额不正确')
  if (categoryId) {
    const c = db.select().from(categories).where(and(inLedger(categories, ledgerId), eq(categories.id, categoryId))).get()
    if (!c || c.type !== 'expense') throw new DomainError('只能给支出分类设预算')
  }
  const id = budgetId(ledgerId, categoryId)
  if (!amountCents) {
    db.update(budgets).set(removed()).where(and(eq(budgets.id, id), isNull(budgets.deletedAt))).run()
    return
  }
  db.insert(budgets)
    .values({ id, ledgerId, categoryId, amountCents, ...touched() })
    .onConflictDoUpdate({ target: budgets.id, set: { amountCents, deletedAt: null, ...touched() } })
    .run()
}

/**
 * 某月的预算进度。花费按月度统计口径：退款冲减；买家当也算花钱（不受「不含家当」开关影响）。
 * 分类被合并或删除后，它的预算不再显示。
 */
export function budgetStatus(db: DB, ledgerId: string, month: string, now = today()): BudgetStatus {
  const list = listBudgets(db, ledgerId)
  if (list.length === 0) return { month, total: null, categories: [] }
  const s = monthSummary(db, ledgerId, month)
  const spentBy = new Map(s.categories.map((c) => [c.categoryId, c.cents]))
  const cats = new Map(listCategories(db, ledgerId, { includeHidden: true }).map((c) => [c.id, c]))
  const daysLeft = daysLeftInMonth(month, now)

  let total: BudgetLine | null = null
  const lines: BudgetLine[] = []
  for (const b of list) {
    if (b.categoryId === null) {
      total = { categoryId: null, name: '本月总预算', icon: null, color: 'mo', ...budgetProgress(b.amountCents, Math.max(0, s.expenseCents), daysLeft) }
      continue
    }
    const c = cats.get(b.categoryId)
    if (!c) continue
    lines.push({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      ...budgetProgress(b.amountCents, spentBy.get(c.id) ?? 0, daysLeft),
    })
  }
  lines.sort((a, b) => b.ratio - a.ratio)
  return { month, total, categories: lines }
}
