import type { BudgetRow } from '../db/schema'
import type { Budget } from '../types/domain'

export function toBudget(r: BudgetRow): Budget {
  return {
    id: r.id,
    ledgerId: r.ledgerId,
    categoryId: r.categoryId,
    // 导入的脏数据：负数或非整数按 0 处理
    amountCents: Number.isInteger(r.amountCents) && r.amountCents > 0 ? r.amountCents : 0,
  }
}
