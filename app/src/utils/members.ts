import type { Member } from '../types/domain'

/**
 * 家庭账本只认“谁记的”，不分“谁花的”（产品取舍，见 docs/决策.md）：一笔账归记账的人（按 createdBy 找成员）。
 * 以前版本标过“谁花的”（memberId）的旧账也按记账人算。找不到（成员已被移出、未登录时记的）返回 null。
 */
export function whoRecorded(t: { createdBy: string | null }, members: Member[]): Member | null {
  if (!t.createdBy) return null
  // 同一个人退出又重新加入时有两行，优先在册的那行
  return members.find((m) => m.userId === t.createdBy && !m.removed) ?? members.find((m) => m.userId === t.createdBy) ?? null
}

/** 列表里显示的名字：谁记的 */
export function whoLabel(t: { createdBy: string | null }, members: Member[]) {
  const m = whoRecorded(t, members)
  if (m) return m.isMe ? '我' : m.nickname
  return t.createdBy ? '已离开的成员' : '未登录时记的'
}

type Recorded = { type: string; amountCents: number; createdBy: string | null }

/** 每人记了多少支出（退款冲减；收入、转账不算）：key 是成员 id，找不到人的记在 '' 下 */
export function recordedSpend(items: Recorded[], members: Member[]) {
  const out = new Map<string, number>()
  for (const t of items) {
    const sign = t.type === 'expense' ? 1 : t.type === 'refund' ? -1 : 0
    if (!sign) continue
    const id = whoRecorded(t, members)?.id ?? ''
    out.set(id, (out.get(id) ?? 0) + sign * t.amountCents)
  }
  return out
}

/** 按人筛选：这笔是不是 memberId 记的 */
export const recordedBy = (t: { createdBy: string | null }, memberId: string, members: Member[]) => whoRecorded(t, members)?.id === memberId
