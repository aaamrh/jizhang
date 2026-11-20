export interface BudgetProgress {
  budgetCents: number
  spentCents: number
  leftCents: number // 可能为负：超支
  ratio: number // 已花 / 预算
  daysLeft: number
  perDayCents: number | null // 剩下每天平均可花；超支或月份已过为 null
}

export function budgetProgress(budgetCents: number, spentCents: number, daysLeft: number): BudgetProgress {
  const leftCents = budgetCents - spentCents
  return {
    budgetCents,
    spentCents,
    leftCents,
    ratio: budgetCents > 0 ? spentCents / budgetCents : 0,
    daysLeft,
    perDayCents: leftCents > 0 && daysLeft > 0 ? Math.floor(leftCents / daysLeft) : null,
  }
}

export type AlertLevel = 80 | 100

/** 当月每档只提醒一次：already 是这个月已经提醒过的最高档（0 = 没提醒过） */
export function budgetAlertLevel(ratio: number, already: number): AlertLevel | null {
  if (ratio > 1 && already < 100) return 100
  if (ratio >= 0.8 && already < 80) return 80
  return null
}
