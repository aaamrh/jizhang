import { and, asc, eq } from 'drizzle-orm'
import { oneOf } from '../mapper/narrow'
import { addDays } from '../utils/dates'
import { COLOR_KEYS, parseIcon, type ColorKey, type IconSpec } from '../utils/iconCatalog'
import { FREQS, nextDate, occurrences, periodEnd, type Freq, type Repeat } from '../utils/recurring'
import { uuidv5 } from '../utils/uuidv5'
import { alive, DomainError, inLedger, newId, removed, restored, touched, type DB } from './core'
import { categories, recurrings as rc, transactions, wallets, type RecurringRow } from './schema'
import { createTxn, getTxn } from './txnRepo'

export interface Recurring {
  id: string
  type: 'expense' | 'income'
  categoryId: string
  amountCents: number
  walletId: string
  note: string
  freq: Freq
  startDate: string
  endDate: string | null
  /** 见 utils/recurring 的 RecurringRule */
  day: number | null
  month: number | null
  doneThrough: string | null
  paused: boolean
}

export interface RecurringView extends Recurring {
  categoryName: string | null
  categoryIcon: IconSpec | null
  categoryColor: ColorKey
  walletName: string | null
  /** 下一次记的日子；暂停或已结束为 null */
  next: string | null
}

export type RecurringInput = Pick<Recurring, 'type' | 'categoryId' | 'amountCents' | 'walletId' | 'note' | 'freq' | 'startDate' | 'endDate' | 'day' | 'month'>

const toRecurring = (r: RecurringRow): Recurring => ({
  id: r.id,
  type: oneOf(r.type, ['expense', 'income'] as const, 'expense'),
  categoryId: r.categoryId,
  amountCents: r.amountCents,
  walletId: r.walletId,
  note: r.note,
  freq: oneOf(r.freq, FREQS, 'month'),
  startDate: r.startDate,
  endDate: r.endDate,
  day: r.day,
  month: r.month,
  doneThrough: r.doneThrough,
  paused: r.paused,
})

/** 自动记的账的 id：同一条周期、同一天永远是同一个 id（两台手机同时补记不会重复） */
export const recurringTxnId = (recurringId: string, date: string) => uuidv5(`recurring:${date}`, recurringId)

export function listRecurrings(db: DB, ledgerId: string, today: string): RecurringView[] {
  return db
    .select({ r: rc, icon: categories.icon, name: categories.name, color: categories.color, wallet: wallets.name })
    .from(rc)
    .leftJoin(categories, and(eq(categories.id, rc.categoryId), alive(categories)))
    .leftJoin(wallets, and(eq(wallets.id, rc.walletId), alive(wallets)))
    .where(inLedger(rc, ledgerId))
    .orderBy(asc(rc.startDate))
    .all()
    .map(({ r, icon, name, color, wallet }) => {
      const x = toRecurring(r)
      return {
        ...x,
        categoryName: name,
        categoryIcon: icon ? parseIcon(icon, name ?? '') : null,
        categoryColor: oneOf(color, COLOR_KEYS, 'mo'),
        walletName: wallet,
        next: x.paused ? null : nextDate(x, x.doneThrough && x.doneThrough >= today ? x.doneThrough : addDays(today, -1)),
      }
    })
}

export function getRecurring(db: DB, id: string): Recurring | undefined {
  const r = db.select().from(rc).where(and(alive(rc), eq(rc.id, id))).get()
  return r ? toRecurring(r) : undefined
}

function validate(v: RecurringInput) {
  if (!Number.isInteger(v.amountCents) || v.amountCents <= 0) throw new DomainError('请输入正确的金额')
  if (!v.categoryId) throw new DomainError('请选择分类')
  if (!v.walletId) throw new DomainError('请选择钱袋')
  if (v.endDate && v.endDate < v.startDate) throw new DomainError('结束日期不能早于开始日期')
  const maxDay = v.freq === 'week' ? 7 : 31
  if (v.day != null && (!Number.isInteger(v.day) || v.day < 1 || v.day > maxDay)) throw new DomainError('重复的日子不对')
  if (v.month != null && (!Number.isInteger(v.month) || v.month < 1 || v.month > 12)) throw new DomainError('重复的月份不对')
  if (Array.from(v.note).length > 100) throw new DomainError('备注最多 100 个字')
}

const values = (v: RecurringInput) => ({ ...v, note: v.note.trim() })

/** doneThrough：已经记到哪天（从一笔已有的账设成周期时，那一笔就算这天记过了，不再重复记） */
export function createRecurring(db: DB, ledgerId: string, v: RecurringInput, doneThrough: string | null = null): string {
  validate(v)
  const id = newId()
  db.insert(rc).values({ id, ledgerId, ...touched(), ...values(v), doneThrough }).run()
  return id
}

/** 用一笔账的内容起一条周期账的草稿（设为周期记账、记一笔时选了“重复”）；只有支出、收入可以 */
export function draftFromTxn(db: DB, txnId: string): (RecurringInput & { txnDate: string }) | undefined {
  const t = getTxn(db, txnId)
  if (!t || (t.type !== 'expense' && t.type !== 'income') || !t.categoryId) return undefined
  return {
    type: t.type,
    categoryId: t.categoryId,
    amountCents: t.amountCents,
    walletId: t.walletId,
    note: t.note,
    freq: 'month',
    startDate: t.date,
    endDate: null,
    day: null,
    month: null,
    txnDate: t.date,
  }
}

/**
 * 记一笔时选了“重复”：用刚记的这笔起一条周期账，从这天开始。
 * 这一笔算这一期（这周 / 这个月 / 这一年）的，下一次从下一期记起：11-20 记的房租选“每月 25 号”，下次是 12-25，不会 11-25 再记一笔
 */
export function recurringFromTxn(db: DB, ledgerId: string, txnId: string, repeat: Repeat): string | undefined {
  const d = draftFromTxn(db, txnId)
  if (!d) return undefined
  const { txnDate, ...v } = d
  return createRecurring(db, ledgerId, { ...v, ...repeat }, periodEnd(repeat.freq, txnDate))
}

/** 改了开始日期：已经记过的不动，从改动后、还没记过的日子接着记 */
export function updateRecurring(db: DB, id: string, v: RecurringInput) {
  validate(v)
  db.update(rc).set({ ...values(v), ...touched() }).where(eq(rc.id, id)).run()
}

/** 暂停 / 恢复。恢复时从今天接着记，暂停期间的不补（today 传今天） */
export function setRecurringPaused(db: DB, id: string, paused: boolean, today: string) {
  const cur = getRecurring(db, id)
  if (!cur) return
  const yesterday = addDays(today, -1)
  const doneThrough = !paused && (!cur.doneThrough || cur.doneThrough < yesterday) ? yesterday : cur.doneThrough
  db.update(rc).set({ paused, doneThrough, ...touched() }).where(eq(rc.id, id)).run()
}

/** 删掉周期：已经自动记下的账留着 */
export const deleteRecurring = (db: DB, id: string) => db.update(rc).set(removed()).where(eq(rc.id, id)).run()
export const restoreRecurring = (db: DB, id: string) => db.update(rc).set(restored()).where(eq(rc.id, id)).run()

/**
 * 到日子的周期账补记上（打开 App、回到前台时调用）。从上次记到的后一天（或开始日）记到今天；
 * 删掉的自动账不会再补回来（按固定 id 查，连已删除的也算）。分类或钱袋不在了：这条先暂停，返回它的名字让界面提示
 */
export function runDueRecurrings(db: DB, ledgerId: string, today: string, createdBy: string | null): { recorded: number; paused: string[] } {
  let recorded = 0
  const paused: string[] = []
  const rules = db
    .select()
    .from(rc)
    .where(and(inLedger(rc, ledgerId), eq(rc.paused, false)))
    .all()
    .map(toRecurring)
  for (const r of rules) {
    const dates = occurrences(r, r.doneThrough ? addDays(r.doneThrough, 1) : r.startDate, today)
    if (!dates.length) continue
    try {
      recorded += db.transaction((tx) => {
        let n = 0
        for (const date of dates) {
          const id = recurringTxnId(r.id, date)
          if (tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, id)).get()) continue
          const input = { type: r.type, amountCents: r.amountCents, categoryId: r.categoryId, walletId: r.walletId, toWalletId: null, date, note: r.note, asset: null }
          createTxn(tx, ledgerId, input, createdBy, { id, recurringId: r.id })
          n++
        }
        tx.update(rc).set({ doneThrough: dates.at(-1)!, ...touched() }).where(eq(rc.id, r.id)).run()
        return n
      })
    } catch (e) {
      if (!(e instanceof DomainError)) throw e
      setRecurringPaused(db, r.id, true, today)
      const cat = db.select({ name: categories.name }).from(categories).where(eq(categories.id, r.categoryId)).get()
      paused.push(r.note || cat?.name || '一条定时记账')
    }
  }
  return { recorded, paused }
}
