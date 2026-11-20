import { and, asc, eq, max, ne, or, sql } from 'drizzle-orm'
import { toWallet } from '../mapper/wallet'
import type { WalletKind, WalletWithBalance } from '../types/domain'
import { alive, DomainError, inLedger, newId, removed, touched, type DB } from './core'
import { transactions as t, wallets } from './schema'

/** 某账本里每个钱袋的账目净流入（不含初始余额）：收入 + 退款 + 转入 − 支出 − 转出 */
export function walletFlows(db: DB, ledgerId: string): Map<string, number> {
  const out = new Map<string, number>()
  const add = (id: string | null, n: number | null) => {
    if (id) out.set(id, (out.get(id) ?? 0) + Number(n ?? 0))
  }
  db.select({
    id: t.walletId,
    s: sql<number>`sum(case when ${t.type} in ('income', 'refund') then ${t.amountCents} else -${t.amountCents} end)`,
  })
    .from(t)
    .where(inLedger(t, ledgerId))
    .groupBy(t.walletId)
    .all()
    .forEach((r) => add(r.id, r.s))
  db.select({ id: t.toWalletId, s: sql<number>`sum(${t.amountCents})` })
    .from(t)
    .where(and(inLedger(t, ledgerId), eq(t.type, 'transfer')))
    .groupBy(t.toWalletId)
    .all()
    .forEach((r) => add(r.id, r.s))
  return out
}

/** includeJars：储钱罐（攒钱目标专用）默认不列出，只在钱袋页和转账时需要 */
export function listWallets(db: DB, ledgerId: string, includeArchived = true, includeJars = false): WalletWithBalance[] {
  const flows = walletFlows(db, ledgerId)
  return db
    .select()
    .from(wallets)
    .where(
      and(
        inLedger(wallets, ledgerId),
        includeArchived ? undefined : eq(wallets.archived, false),
        includeJars ? undefined : ne(wallets.kind, 'jar'),
      ),
    )
    .orderBy(asc(wallets.sort), asc(wallets.name))
    .all()
    .map((r) => {
      const w = toWallet(r)
      return { ...w, balanceCents: w.initialCents + (flows.get(w.id) ?? 0) }
    })
}

export function getWallet(db: DB, id: string) {
  const r = db.select().from(wallets).where(and(alive(wallets), eq(wallets.id, id))).get()
  return r ? toWallet(r) : undefined
}

function checkName(name: string) {
  const n = name.trim()
  if (!n) throw new DomainError('请填写钱袋名称')
  if (Array.from(n).length > 20) throw new DomainError('名称最多 20 个字')
  return n
}

export function createWallet(db: DB, ledgerId: string, v: { name: string; kind: WalletKind; initialCents: number }) {
  if (!Number.isInteger(v.initialCents)) throw new DomainError('余额不正确')
  const [{ m } = { m: 0 }] = db.select({ m: max(wallets.sort) }).from(wallets).where(eq(wallets.ledgerId, ledgerId)).all()
  const id = newId()
  db.insert(wallets)
    .values({ id, ledgerId, ...touched(), name: checkName(v.name), kind: v.kind, initialCents: v.initialCents, sort: (m ?? 0) + 1 })
    .run()
  return id
}

export function updateWallet(db: DB, id: string, v: { name: string; kind: WalletKind }) {
  db.update(wallets).set({ name: checkName(v.name), kind: v.kind, ...touched() }).where(eq(wallets.id, id)).run()
}

export function setWalletArchived(db: DB, id: string, archived: boolean) {
  db.update(wallets).set({ archived, ...touched() }).where(eq(wallets.id, id)).run()
}

export function walletHasTxns(db: DB, id: string) {
  return !!db
    .select({ id: t.id })
    .from(t)
    .where(and(alive(t), or(eq(t.walletId, id), eq(t.toWalletId, id))))
    .limit(1)
    .get()
}

/** 只有没记过账的钱袋能删，否则只能归档 */
export function deleteWallet(db: DB, id: string) {
  if (walletHasTxns(db, id)) throw new DomainError('这个钱袋记过账，不能删除，可以归档')
  db.update(wallets).set(removed()).where(eq(wallets.id, id)).run()
}

/** 校准：输入“现在实际是多少”，反推初始余额，不产生账目 */
export function calibrateWallet(db: DB, id: string, actualCents: number) {
  const w = getWallet(db, id)
  if (!w) throw new DomainError('钱袋不存在')
  if (!Number.isInteger(actualCents)) throw new DomainError('余额不正确')
  const flow = walletFlows(db, w.ledgerId).get(id) ?? 0
  db.update(wallets).set({ initialCents: actualCents - flow, ...touched() }).where(eq(wallets.id, id)).run()
}
