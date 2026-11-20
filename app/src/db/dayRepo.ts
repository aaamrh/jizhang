import { and, eq, isNull } from 'drizzle-orm'
import { alive, removed, touched, type DB } from './core'
import { dayMarks, transactions } from './schema'
import { defaultId } from './seed'

/** "今天没花钱"标记的 id：同一天在多台手机上点也只有一条 */
export const dayMarkId = (ledgerId: string, date: string) => defaultId(ledgerId, `nospend:${date}`)

/** 记过账的日期：任何账本里未删除账目的日期 + "今天没花钱"标记（可能重复，调用方去重） */
export function recordedDays(db: DB): string[] {
  // 周期记账自动记的不算“记过账”
  const txnDays = db.selectDistinct({ d: transactions.date }).from(transactions).where(and(alive(transactions), isNull(transactions.recurringId))).all()
  const marks = db.selectDistinct({ d: dayMarks.date }).from(dayMarks).where(alive(dayMarks)).all()
  return [...txnDays, ...marks].map((r) => r.d)
}

export function hasNoSpend(db: DB, date: string) {
  return !!db.select({ id: dayMarks.id }).from(dayMarks).where(and(alive(dayMarks), eq(dayMarks.date, date))).get()
}

/** 某天是否算记过账 */
export function isDayCounted(db: DB, date: string) {
  return hasNoSpend(db, date) || !!db.select({ id: transactions.id }).from(transactions).where(and(alive(transactions), eq(transactions.date, date), isNull(transactions.recurringId))).get()
}

/** 打上或撤销“今天没花钱”（记在个人账本） */
export function setNoSpend(db: DB, personalLedgerId: string, date: string, on: boolean) {
  const id = dayMarkId(personalLedgerId, date)
  if (!on) {
    db.update(dayMarks).set(removed()).where(and(eq(dayMarks.id, id), isNull(dayMarks.deletedAt))).run()
    return
  }
  db.insert(dayMarks)
    .values({ id, ledgerId: personalLedgerId, date, ...touched() })
    .onConflictDoUpdate({ target: dayMarks.id, set: { deletedAt: null, ...touched() } })
    .run()
}
