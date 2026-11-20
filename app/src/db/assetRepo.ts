import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { toAsset } from '../mapper/asset'
import type { Asset, CostMode } from '../types/domain'
import { alive, DomainError, inLedger, newId, now, removed, touched, type DB } from './core'
import { saleCategory } from './categoryRepo'
import { assets, transactions as t, wallets } from './schema'

/** 由支出生成的家当 id 集合 */
function fromTxnIds(db: DB, ledgerId: string) {
  return new Set(
    db
      .select({ id: t.assetId })
      .from(t)
      .where(and(inLedger(t, ledgerId), eq(t.type, 'expense'), isNotNull(t.assetId)))
      .all()
      .map((r) => r.id!),
  )
}

export function listAssets(db: DB, ledgerId: string): Asset[] {
  const linked = fromTxnIds(db, ledgerId)
  return db
    .select()
    .from(assets)
    .where(inLedger(assets, ledgerId))
    .orderBy(desc(assets.acquiredOn), desc(assets.updatedAt))
    .all()
    .map((r) => toAsset(r, linked.has(r.id)))
}

export function getAsset(db: DB, id: string): Asset | undefined {
  const r = db.select().from(assets).where(and(alive(assets), eq(assets.id, id))).get()
  return r ? toAsset(r, fromTxnIds(db, r.ledgerId).has(id)) : undefined
}

function mustGet(db: DB, id: string) {
  const a = getAsset(db, id)
  if (!a) throw new DomainError('这件家当已经不存在了')
  return a
}

function checkName(name: string) {
  const n = name.trim()
  if (!n) throw new DomainError('请填写名称')
  if (Array.from(n).length > 30) throw new DomainError('名称最多 30 个字')
  return n
}

const checkCost = (cents: number) => {
  if (!Number.isInteger(cents) || cents < 0) throw new DomainError('买价不正确')
}

/** 手动添加已有物品：不动钱袋 */
export function createAsset(db: DB, ledgerId: string, v: { name: string; costCents: number; acquiredOn: string; note: string }) {
  checkCost(v.costCents)
  const id = newId()
  db.insert(assets)
    .values({ id, ledgerId, ...touched(), name: checkName(v.name), costCents: v.costCents, acquiredOn: v.acquiredOn, note: v.note.trim() })
    .run()
  return id
}

/** 由支出生成的家当，买价和日期跟着那笔支出走，这里只能改名称和备注 */
export function updateAsset(db: DB, id: string, v: { name: string; note: string; costCents: number; acquiredOn: string }) {
  const a = mustGet(db, id)
  const lockMoney = a.fromTxn || a.status !== 'holding'
  if (lockMoney && (v.costCents !== a.costCents || v.acquiredOn !== a.acquiredOn)) {
    throw new DomainError(a.fromTxn ? '买价和日期请到对应的那笔支出里改' : '已出手的家当不能改买价和日期')
  }
  checkCost(v.costCents)
  db.update(assets)
    .set({ name: checkName(v.name), note: v.note.trim(), costCents: v.costCents, acquiredOn: v.acquiredOn, ...touched() })
    .where(eq(assets.id, id))
    .run()
}

export function setUseCount(db: DB, id: string, n: number) {
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new DomainError('使用次数不正确')
  db.update(assets).set({ useCount: n, ...touched() }).where(eq(assets.id, id)).run()
}

/** 计价方式：按天 / 按次 */
export function setCostMode(db: DB, id: string, mode: CostMode) {
  db.update(assets).set({ costMode: mode, ...touched() }).where(eq(assets.id, id)).run()
}

/**
 * 换照片 / 删照片：本机路径立刻生效，云端 id 清空（登录同步时由上传队列补上），返回旧的云端 id 以便删除云端旧文件。
 * 照片变化是要同步的（别的手机要知道照片换了），所以标记 dirty。
 */
export function setAssetPhoto(db: DB, id: string, path: string | null): string | null {
  const old = db.select({ fileId: assets.photoFileId }).from(assets).where(eq(assets.id, id)).get()
  db.update(assets).set({ photo: path, photoFileId: null, photoCachedFor: null, ...touched() }).where(eq(assets.id, id)).run()
  return old?.fileId ?? null
}

export function addUse(db: DB, id: string) {
  db.update(assets)
    .set({ useCount: sql`${assets.useCount} + 1`, ...touched() })
    .where(eq(assets.id, id))
    .run()
}

function checkEnd(a: Asset, date: string) {
  if (a.status !== 'holding') throw new DomainError('这件家当已经出手了')
  if (date < a.acquiredOn) throw new DomainError('日期不能早于买入日期')
}

/** 卖出：生成一笔“变卖”收入进所选钱袋（同一账本） */
export function sellAsset(db: DB, id: string, v: { priceCents: number; date: string; walletId: string }) {
  const a = mustGet(db, id)
  checkEnd(a, v.date)
  if (!Number.isInteger(v.priceCents) || v.priceCents < 0) throw new DomainError('卖价不正确')
  const wallet = db.select().from(wallets).where(and(inLedger(wallets, a.ledgerId), eq(wallets.id, v.walletId))).get()
  if (!wallet) throw new DomainError('请选择入账钱袋')
  const sale = saleCategory(db, a.ledgerId)
  db.transaction((tx) => {
    // 卖价为 0（送人）时不生成收入
    if (v.priceCents > 0) {
      tx.insert(t)
        .values({
          id: newId(),
          ledgerId: a.ledgerId,
          ...touched(),
          createdAt: now(),
          type: 'income',
          amountCents: v.priceCents,
          categoryId: sale.id,
          walletId: v.walletId,
          date: v.date,
          note: `卖出 ${a.name}`,
          assetId: id,
        })
        .run()
    }
    tx.update(assets)
      .set({ status: 'sold', soldCents: v.priceCents, soldWalletId: v.walletId, endedOn: v.date, ...touched() })
      .where(eq(assets.id, id))
      .run()
  })
}

/** 丢失 / 损坏：只记日期，不动钱 */
export function endAsset(db: DB, id: string, status: 'lost' | 'broken', date: string) {
  checkEnd(mustGet(db, id), date)
  db.update(assets).set({ status, endedOn: date, ...touched() }).where(eq(assets.id, id)).run()
}

/** 撤销：恢复成持有中，删掉卖出生成的收入 */
export function undoAssetEnd(db: DB, id: string) {
  const a = mustGet(db, id)
  if (a.status === 'holding') return
  db.transaction((tx) => {
    tx.update(t)
      .set(removed())
      .where(and(alive(t), eq(t.type, 'income'), eq(t.assetId, id)))
      .run()
    tx.update(assets)
      .set({ status: 'holding', endedOn: null, soldCents: null, soldWalletId: null, ...touched() })
      .where(eq(assets.id, id))
      .run()
  })
}

/** 只能删持有中的；由支出生成的，那笔支出保留，只是不再算家当 */
export function deleteAsset(db: DB, id: string) {
  const a = mustGet(db, id)
  if (a.status !== 'holding') throw new DomainError('已出手的家当不能删除，可以先撤销')
  db.transaction((tx) => {
    tx.update(t).set({ assetId: null, ...touched() }).where(and(alive(t), eq(t.assetId, id))).run()
    tx.update(assets).set(removed()).where(eq(assets.id, id)).run()
  })
}
