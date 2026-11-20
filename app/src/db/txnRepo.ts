import { and, asc, count, desc, eq, gte, inArray, like, lt, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { toTxn, toTxnView } from '../mapper/txn'
import type { Review, Txn, TxnInput, TxnView } from '../types/domain'
import { monthRange } from '../utils/dates'
import { legacyReview, necessityOf, type Necessity } from '../utils/necessity'
import { parseYuan } from '../utils/money'
import { cleanTags, MAX_TAGS, TAG_MAX_LEN, tagsJson } from '../utils/tags'
import { alive, DomainError, inLedger, newId, now, removed, restored, touched, type DB } from './core'
import { assets, categories, transactions as t, wallets } from './schema'

const toWallets = alias(wallets, 'to_wallets')

/** 带分类、钱袋名称的账目查询 */
function viewQuery(db: DB) {
  return db
    .select({
      txn: t,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      tier: categories.tier,
      walletName: wallets.name,
      toWalletName: toWallets.name,
    })
    .from(t)
    .leftJoin(categories, eq(categories.id, t.categoryId))
    .leftJoin(wallets, eq(wallets.id, t.walletId))
    .leftJoin(toWallets, eq(toWallets.id, t.toWalletId))
}

export function getTxn(db: DB, id: string): Txn | undefined {
  const r = db.select().from(t).where(and(alive(t), eq(t.id, id))).get()
  return r ? toTxn(r) : undefined
}

export function getTxnView(db: DB, id: string): TxnView | undefined {
  const r = viewQuery(db).where(and(alive(t), eq(t.id, id))).get()
  return r ? toTxnView(r) : undefined
}

export function listMonthTxns(db: DB, ledgerId: string, month: string): TxnView[] {
  const { start, end } = monthRange(month)
  return viewQuery(db)
    .where(and(inLedger(t, ledgerId), gte(t.date, start), lt(t.date, end)))
    .orderBy(desc(t.date), desc(t.createdAt))
    .all()
    .map(toTxnView)
}

/** 在一个账本里按备注、分类名、标签、金额查找，最多 200 条 */
export function searchTxns(db: DB, ledgerId: string, q: string): TxnView[] {
  const kw = q.trim().replace(/[%_\\]/g, '')
  if (!kw) return []
  const cents = parseYuan(kw)
  return viewQuery(db)
    .where(
      and(
        inLedger(t, ledgerId),
        or(like(t.note, `%${kw}%`), like(categories.name, `%${kw}%`), like(t.tags, `%${kw}%`), cents !== null ? eq(t.amountCents, cents) : undefined),
      ),
    )
    .orderBy(desc(t.date), desc(t.createdAt))
    .limit(200)
    .all()
    .map(toTxnView)
}

/** 带某个标签的所有账（不分月份），从新到旧。先用 LIKE 粗筛 JSON 文本，再按解析后的数组精确匹配 */
export function listTagTxns(db: DB, ledgerId: string, name: string): TxnView[] {
  const pattern = `%${JSON.stringify(name).replace(/[\\%_]/g, '\\$&')}%`
  return viewQuery(db)
    .where(and(inLedger(t, ledgerId), sql`${t.tags} like ${pattern} escape '\\'`))
    .orderBy(desc(t.date), desc(t.createdAt))
    .all()
    .map(toTxnView)
    .filter((x) => x.tags.includes(name))
}

export function countTxns(db: DB, ledgerId: string) {
  return db.select({ n: count() }).from(t).where(inLedger(t, ledgerId)).get()?.n ?? 0
}

/** 所有账本的记账笔数（“我的”页） */
export function countAllTxns(db: DB) {
  return db.select({ n: count() }).from(t).where(alive(t)).get()?.n ?? 0
}

const walletIn = (db: DB, ledgerId: string, id: string | null) =>
  !!id && !!db.select({ id: wallets.id }).from(wallets).where(and(inLedger(wallets, ledgerId), eq(wallets.id, id))).get()

function validate(db: DB, ledgerId: string, v: TxnInput) {
  if (!Number.isInteger(v.amountCents) || v.amountCents <= 0) throw new DomainError('请输入大于 0 的金额')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) throw new DomainError('日期不正确')
  if (Array.from(v.note).length > 100) throw new DomainError('备注最多 100 个字')
  if (v.tags && cleanTags(v.tags).length > MAX_TAGS) throw new DomainError(`一笔最多带 ${MAX_TAGS} 个标签`)
  if (v.tags?.some((x) => Array.from(x.trim()).length > TAG_MAX_LEN)) throw new DomainError(`标签最多 ${TAG_MAX_LEN} 个字`)
  if (!walletIn(db, ledgerId, v.walletId)) throw new DomainError('请选择钱袋')
  if (v.type === 'transfer') {
    if (!v.toWalletId || v.toWalletId === v.walletId || !walletIn(db, ledgerId, v.toWalletId)) {
      throw new DomainError('请选择另一个转入钱袋')
    }
    return
  }
  const cat = v.categoryId
    ? db.select().from(categories).where(and(inLedger(categories, ledgerId), eq(categories.id, v.categoryId))).get()
    : undefined
  if (!cat) throw new DomainError('请选择分类')
  // 退款/报销冲减的是支出分类
  const want = v.type === 'income' ? 'income' : 'expense'
  if (cat.type !== want) throw new DomainError(want === 'income' ? '请选择收入分类' : '请选择支出分类')
  if (v.asset && v.type !== 'expense') throw new DomainError('只有支出可以计入家当')
  if (v.asset && !v.asset.name.trim()) throw new DomainError('请填写家当名称')
}

const fields = (v: TxnInput) => ({
  type: v.type,
  amountCents: v.amountCents,
  categoryId: v.type === 'transfer' ? null : v.categoryId,
  walletId: v.walletId,
  toWalletId: v.type === 'transfer' ? v.toWalletId : null,
  date: v.date,
  note: v.note.trim(),
  memberId: v.memberId ?? null,
  // 不传 tags：新记一笔没有标签，改账时保留原来的
  ...(v.tags ? { tags: tagsJson(v.tags) } : {}),
})

function insertAsset(db: DB, ledgerId: string, v: TxnInput) {
  const id = newId()
  db.insert(assets)
    .values({ id, ledgerId, ...touched(), name: v.asset!.name.trim(), costCents: v.amountCents, acquiredOn: v.date })
    .run()
  return id
}

/** createdBy：登录后为当前用户 id，未登录为 null。opts：周期记账自动记时给定 id 和来源周期 */
export function createTxn(
  db: DB,
  ledgerId: string,
  v: TxnInput,
  createdBy: string | null = null,
  opts: { id?: string; recurringId?: string } = {},
): string {
  validate(db, ledgerId, v)
  return db.transaction((tx) => {
    const assetId = v.type === 'expense' && v.asset ? insertAsset(tx, ledgerId, v) : null
    const id = opts.id ?? newId()
    tx.insert(t)
      .values({ id, ledgerId, ...touched(), createdAt: now(), createdBy, ...fields(v), assetId, recurringId: opts.recurringId ?? null })
      .run()
    return id
  })
}

/** 换照片（null = 去掉）：返回被换掉的云端照片 id，调用方顺手删掉云端旧文件 */
export function setTxnPhoto(db: DB, id: string, photo: string | null): string | null {
  const cur = db.select({ photoFileId: t.photoFileId }).from(t).where(eq(t.id, id)).get()
  db.update(t).set({ photo, photoFileId: null, photoCachedFor: null, ...touched() }).where(eq(t.id, id)).run()
  return cur?.photoFileId ?? null
}

const isSaleTxn = (x: Txn) => x.type === 'income' && x.assetId !== null

export function updateTxn(db: DB, id: string, v: TxnInput) {
  const cur = getTxn(db, id)
  if (!cur) throw new DomainError('这笔账已经不存在了')
  if (isSaleTxn(cur)) throw new DomainError('这笔是家当卖出生成的，请到家当里修改或撤销')
  validate(db, cur.ledgerId, v)
  db.transaction((tx) => {
    let assetId = cur.assetId
    const asset = assetId ? tx.select().from(assets).where(and(alive(assets), eq(assets.id, assetId))).get() : undefined
    const keep = v.type === 'expense' && !!v.asset
    if (asset && asset.status !== 'holding') {
      // 家当已经出手：买价、日期和关联都不能再动，只能改名
      if (!keep || v.amountCents !== cur.amountCents || v.date !== cur.date) {
        throw new DomainError('关联的家当已经出手，金额、日期和「计入家当」不能再改')
      }
      tx.update(assets).set({ name: v.asset!.name.trim(), ...touched() }).where(eq(assets.id, asset.id)).run()
    } else if (asset && keep) {
      tx.update(assets)
        .set({ name: v.asset!.name.trim(), costCents: v.amountCents, acquiredOn: v.date, ...touched() })
        .where(eq(assets.id, asset.id))
        .run()
    } else if (asset) {
      tx.update(assets).set(removed()).where(eq(assets.id, asset.id)).run()
      assetId = null
    } else {
      assetId = keep ? insertAsset(tx, cur.ledgerId, v) : null
    }
    // 变成非支出后，复盘标记不再有意义
    const review = v.type === 'expense' ? cur.review : null
    tx.update(t)
      .set({ ...fields(v), assetId, review, ...touched() })
      .where(eq(t.id, id))
      .run()
  })
}

/** 删除规则：卖出生成的收入不能删；关联家当的支出连家当一起删，但家当已出手则不行 */
/** 这笔账不能删的原因（家当卖出生成的、关联家当已出手）；能删返回 null */
export function deleteBlocker(db: DB, id: string): string | null {
  const cur = getTxn(db, id)
  if (!cur) return null
  if (isSaleTxn(cur)) return '这笔是家当卖出生成的，请到家当里撤销卖出'
  const asset = cur.assetId ? db.select().from(assets).where(and(alive(assets), eq(assets.id, cur.assetId))).get() : undefined
  if (asset && asset.status !== 'holding') return '关联的家当已经出手，不能删除这笔支出。可以先在家当里撤销'
  return null
}

export function deleteTxn(db: DB, id: string) {
  const cur = getTxn(db, id)
  if (!cur) return
  const blocker = deleteBlocker(db, id)
  if (blocker) throw new DomainError(blocker)
  const asset = cur.assetId ? db.select().from(assets).where(and(alive(assets), eq(assets.id, cur.assetId))).get() : undefined
  db.transaction((tx) => {
    tx.update(t).set(removed()).where(eq(t.id, id)).run()
    if (asset) tx.update(assets).set(removed()).where(eq(assets.id, asset.id)).run()
  })
}

/** 撤销删除：这笔账和跟它一起删掉的家当都回来 */
export function restoreTxn(db: DB, id: string) {
  const cur = db.select().from(t).where(eq(t.id, id)).get()
  if (!cur?.deletedAt) return
  const asset = cur.assetId ? db.select().from(assets).where(eq(assets.id, cur.assetId)).get() : undefined
  db.transaction((tx) => {
    tx.update(t).set(restored()).where(eq(t.id, id)).run()
    // 只恢复同一次删掉的家当（前后差不到 1 秒），早先单独删掉的不动
    if (asset?.deletedAt && Math.abs(asset.deletedAt - cur.deletedAt!) < 1000) tx.update(assets).set(restored()).where(eq(assets.id, asset.id)).run()
  })
}

export function setReview(db: DB, id: string, review: Review | null) {
  db.update(t).set({ review, ...touched() }).where(eq(t.id, id)).run()
}

/**
 * 这个月弹性 + 享受两档的每一笔支出（用户：每笔弹性的都要看，不能只看最大的 8 笔）。
 * 新的在前：每晚提醒看的是当天刚花的，打开就是它们
 */
function reviewPool(db: DB, ledgerId: string, month: string): TxnView[] {
  const { start, end } = monthRange(month)
  return viewQuery(db)
    .where(
      and(
        inLedger(t, ledgerId),
        eq(t.type, 'expense'),
        gte(t.date, start),
        lt(t.date, end),
        inArray(categories.tier, ['flex', 'want']),
      ),
    )
    .orderBy(desc(t.date), desc(t.amountCents), asc(t.createdAt))
    .all()
    .map(toTxnView)
}

/**
 * 复盘：这个月弹性、享受里还没标记的每一笔。
 * "下次再说"直接离开页面，不写数据库；已经标记的保留。
 */
export function reviewCandidates(db: DB, ledgerId: string, month: string): TxnView[] {
  return reviewPool(db, ledgerId, month).filter((x) => x.review === null)
}

/** 这个月已经标记过的（必要 / 非必要），复盘页列出来，可以改 */
export function reviewedList(db: DB, ledgerId: string, month: string): TxnView[] {
  return reviewPool(db, ledgerId, month).filter((x) => x.review !== null)
}

/**
 * 旧版本的复盘值（worth / ok / regret / skip）改成 必要 / 非必要 / 没复盘，并标记待同步。
 * 启动时执行；读的时候 mapper 也会兼容，防止别的手机上传旧值。
 */
export function migrateLegacyReviews(db: DB) {
  const rows = db
    .select({ id: t.id, review: t.review })
    .from(t)
    .where(inArray(t.review, ['worth', 'ok', 'regret', 'skip']))
    .all()
  for (const r of rows) db.update(t).set({ review: legacyReview(r.review), ...touched() }).where(eq(t.id, r.id)).run()
  return rows.length
}

/** 某个分类在 [start, end) 里的账目（支出和退款），用于统计里点开分类看明细 */
export interface EntriesQuery {
  start: string
  end: string // 不含
  /** 只看这一类；null 表示所有支出类 */
  categoryId: string | null
  /** 只看必要 / 非必要 / 待定（按 necessityOf 判断）；'all' 不筛 */
  necessity: Necessity | 'all'
  /** 去掉买家当的支出（盘账的“不含家当”开关） */
  excludeAssets?: boolean
}

/**
 * 一段时间里的支出明细（含退款）：分类明细、按必要性看、某个月的全部支出都用这一个查询。
 * 只看必要性时按金额从大到小，其余按日期从新到旧
 */
export function listEntries(db: DB, ledgerId: string, q: EntriesQuery): TxnView[] {
  const rows = viewQuery(db)
    .where(
      and(
        inLedger(t, ledgerId),
        q.categoryId ? eq(t.categoryId, q.categoryId) : undefined,
        inArray(t.type, ['expense', 'refund']),
        gte(t.date, q.start),
        lt(t.date, q.end),
        q.excludeAssets ? sql`not (${t.type} = 'expense' and ${t.assetId} is not null)` : undefined,
      ),
    )
    .orderBy(desc(t.date), desc(t.createdAt))
    .all()
    .map(toTxnView)
    .filter((x) => q.necessity === 'all' || necessityOf(x.review, x.tier) === q.necessity)
  if (q.necessity !== 'all' && !q.categoryId) rows.sort((a, b) => b.amountCents - a.amountCents)
  return rows
}
