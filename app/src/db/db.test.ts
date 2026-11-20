import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { TxnInput } from '../types/domain'
import { addUse, createAsset, deleteAsset, endAsset, getAsset, listAssets, sellAsset, setUseCount, undoAssetEnd } from './assetRepo'
import { exportLedger, importLedger, parseBackup } from './backup'
import { createCategory, listCategories, mergeCategory, migrateLegacyIcons, reorderCategories, setCategoryHidden } from './categoryRepo'
import { DomainError, type DB } from './core'
import { createLedger, ensurePersonalLedger, listLedgers } from './ledgerRepo'
import { assets as assetsT, categories as categoriesT, transactions as txnsT, wallets as walletsT } from './schema'
import { defaultId } from './seed'
import { monthSummary } from './statsRepo'
import { makeTestDb } from './testDb'
import {
  countTxns,
  createTxn,
  deleteBlocker,
  deleteTxn,
  getTxn,
  restoreTxn,
  listEntries,
  listMonthTxns,
  migrateLegacyReviews,
  reviewCandidates,
  reviewedList,
  listTagTxns,
  searchTxns,
  setReview,
  setTxnPhoto,
  updateTxn,
} from './txnRepo'
import { allTagTotals, deleteTag, recentTags, renameTag, restoreTags, tagTotalsIn } from './tagRepo'
import { createRecurring, deleteRecurring, draftFromTxn, getRecurring, listRecurrings, recurringFromTxn, recurringTxnId, runDueRecurrings, setRecurringPaused } from './recurringRepo'
import { isDayCounted, recordedDays } from './dayRepo'
import { calibrateWallet, createWallet, deleteWallet, listWallets } from './walletRepo'

let db: DB
let L: string // 当前账本
let W: Record<string, string> // 钱袋名 → id
let C: Record<string, string> // 分类名 → id

beforeEach(async () => {
  ;({ db, ledgerId: L } = await makeTestDb())
  W = Object.fromEntries(listWallets(db, L).map((w) => [w.name, w.id]))
  C = Object.fromEntries(listCategories(db, L, { includeHidden: true }).map((c) => [c.name, c.id]))
})

const tx = (v: Partial<TxnInput> & Pick<TxnInput, 'type' | 'amountCents'>): TxnInput => ({
  categoryId: null,
  walletId: W['银行卡']!,
  toWalletId: null,
  date: '2026-11-10',
  note: '',
  asset: null,
  ...v,
})
const expense = (cat: string, cents: number, more: Partial<TxnInput> = {}) =>
  createTxn(db, L, tx({ type: 'expense', amountCents: cents, categoryId: C[cat]!, ...more }))
const balance = (name: string) => listWallets(db, L).find((w) => w.name === name)!.balanceCents

describe('默认数据', () => {
  it('四个钱袋、22 个支出分类、7 个收入分类，“变卖”是系统分类', () => {
    expect(Object.keys(W)).toEqual(['现金', '银行卡', '支付宝', '微信'])
    expect(listCategories(db, L, { type: 'expense' })).toHaveLength(22)
    const income = listCategories(db, L, { type: 'income' })
    expect(income).toHaveLength(7)
    expect(income.find((c) => c.name === '变卖')!.key).toBe('income.sale')
    expect(() => setCategoryHidden(db, C['变卖']!, true)).toThrow(DomainError)
  })
})

describe('钱袋余额', () => {
  it('收入、支出、退款、转账；信用卡是负债', () => {
    const card = createWallet(db, L, { name: '招行信用卡', kind: 'credit', initialCents: 0 })
    createTxn(db, L, tx({ type: 'income', amountCents: 1_000_000, categoryId: C['工资']! }))
    expense('外出就餐', 30_000, { walletId: card })
    createTxn(db, L, tx({ type: 'refund', amountCents: 5_000, categoryId: C['外出就餐']!, walletId: card }))
    // 还信用卡 = 银行卡转到信用卡
    createTxn(db, L, tx({ type: 'transfer', amountCents: 25_000, toWalletId: card }))

    expect(balance('银行卡')).toBe(1_000_000 - 25_000)
    expect(balance('招行信用卡')).toBe(0)
    const w = listWallets(db, L).find((x) => x.id === card)!
    expect(w.liability).toBe(true)
  })

  it('转账必须是两个不同的钱袋', () => {
    expect(() => createTxn(db, L, tx({ type: 'transfer', amountCents: 100, toWalletId: W['银行卡']! }))).toThrow(DomainError)
  })

  it('校准余额：反推初始余额，不产生账目', () => {
    expense('买菜', 2_000)
    calibrateWallet(db, W['银行卡']!, 50_000)
    expect(balance('银行卡')).toBe(50_000)
    expect(countTxns(db, L)).toBe(1)
  })

  it('记过账的钱袋不能删，只能归档', () => {
    expense('买菜', 100, { walletId: W['现金']! })
    expect(() => deleteWallet(db, W['现金']!)).toThrow('归档')
    deleteWallet(db, W['微信']!)
    expect(listWallets(db, L).map((w) => w.name)).not.toContain('微信')
  })
})

describe('月度统计', () => {
  it('退款冲减对应分类；转账不计收支；分档占比', () => {
    createTxn(db, L, tx({ type: 'income', amountCents: 800_000, categoryId: C['工资']! }))
    expense('住房', 300_000)
    expense('外出就餐', 50_000)
    expense('零食饮品', 10_000)
    createTxn(db, L, tx({ type: 'refund', amountCents: 20_000, categoryId: C['外出就餐']! }))
    createTxn(db, L, tx({ type: 'transfer', amountCents: 99_999, toWalletId: W['现金']! }))
    expense('娱乐', 999, { date: '2026-10-31' }) // 上个月，不算

    const s = monthSummary(db, L, '2026-11')
    expect(s.incomeCents).toBe(800_000)
    expect(s.expenseCents).toBe(340_000)
    expect(s.balanceCents).toBe(460_000)
    expect(s.necessity).toEqual({ necessary: 300_000, pending: 30_000, unnecessary: 10_000 })
    expect(s.categories.map((c) => [c.name, c.cents])).toEqual([
      ['住房', 300_000],
      ['外出就餐', 30_000],
      ['零食饮品', 10_000],
    ])
    expect(s.txnCount).toBe(6)
  })

  it('不含家当：买家当的支出不计入', () => {
    expense('数码', 600_000, { asset: { name: '手机' } })
    expense('外出就餐', 5_000)
    expect(monthSummary(db, L, '2026-11').expenseCents).toBe(605_000)
    expect(monthSummary(db, L, '2026-11', true).expenseCents).toBe(5_000)
  })

  it('必要性：复盘标记优先，没标记按档位；筛选只算那一种', () => {
    const a = expense('外出就餐', 100)
    const b = expense('游戏', 200)
    const c = expense('住房', 400)
    expense('外出就餐', 800) // 弹性没复盘 → 待定
    setReview(db, a, 'necessary')
    setReview(db, b, 'necessary') // 享受类也可以标成必要
    setReview(db, c, 'unnecessary')
    const s = monthSummary(db, L, '2026-11')
    expect(s.necessity).toEqual({ necessary: 300, unnecessary: 400, pending: 800 })
    expect(s.reviewed).toBe(2) // 只数弹性和享受里复盘过的
    const only = monthSummary(db, L, '2026-11', false, 'necessary')
    expect(only.expenseCents).toBe(300)
    expect(only.categories.map((x) => [x.name, x.cents])).toEqual([
      ['游戏', 200],
      ['外出就餐', 100],
    ])
    expect(monthSummary(db, L, '2026-11', false, 'pending').expenseCents).toBe(800)
  })

  it('点开分类：这段时间这一类的每一笔', () => {
    expense('外出就餐', 100)
    expense('外出就餐', 200, { date: '2026-10-31' })
    expense('游戏', 300)
    expect(listEntries(db, L, { start: '2026-11-01', end: '2026-12-01', categoryId: C['外出就餐']!, necessity: 'all' }).map((x) => x.amountCents)).toEqual([100])
  })

  it('一段时间的明细：整月全部、按必要性（按金额排）、区间不含结束日', () => {
    expense('外出就餐', 100, { date: '2026-11-03' })
    expense('住房', 5000, { date: '2026-11-05' }) // 必需 → 必要
    expense('游戏', 300, { date: '2026-11-07' }) // 享受 → 非必要
    expense('娱乐', 800, { date: '2026-11-08' }) // 享受 → 非必要
    expense('游戏', 50, { date: '2026-11-09' }) // 不在区间（结束日不含）
    const week = { start: '2026-11-02', end: '2026-11-09' }
    expect(listEntries(db, L, { ...week, categoryId: null, necessity: 'all' }).map((x) => x.amountCents)).toEqual([800, 300, 5000, 100])
    expect(listEntries(db, L, { ...week, categoryId: null, necessity: 'unnecessary' }).map((x) => x.amountCents)).toEqual([800, 300])
    expect(listEntries(db, L, { ...week, categoryId: null, necessity: 'pending' }).map((x) => x.amountCents)).toEqual([100])
    expect(listEntries(db, L, { ...week, categoryId: C['游戏']!, necessity: 'unnecessary' }).map((x) => x.amountCents)).toEqual([300])
  })
})

describe('复盘候选', () => {
  it('弹性+享受里最大的 8 笔中未标记的', () => {
    for (let i = 1; i <= 10; i++) expense(i % 2 ? '外出就餐' : '娱乐', i * 100)
    expense('住房', 999_999) // 必需，不参与
    let list = reviewCandidates(db, L, '2026-11')
    expect(list.map((x) => x.amountCents)).toEqual([1000, 900, 800, 700, 600, 500, 400, 300])
    setReview(db, list[0]!.id, 'necessary')
    setReview(db, list[1]!.id, 'unnecessary')
    list = reviewCandidates(db, L, '2026-11')
    expect(list).toHaveLength(6) // 标记过的不再出现，也不会补进第 9、10 笔
    expect(list[0]!.amountCents).toBe(800)
  })

  it('标了 2 笔点“下次再说”：标过的仍能在“已复盘”里看到并修改，没标的下次还在', () => {
    for (let i = 1; i <= 5; i++) expense('外出就餐', i * 100)
    const [a, b] = reviewCandidates(db, L, '2026-11')
    setReview(db, a!.id, 'necessary')
    setReview(db, b!.id, 'unnecessary')
    expect(reviewCandidates(db, L, '2026-11').map((x) => x.amountCents)).toEqual([300, 200, 100])
    expect(reviewedList(db, L, '2026-11').map((x) => [x.amountCents, x.review])).toEqual([
      [500, 'necessary'],
      [400, 'unnecessary'],
    ])
    setReview(db, b!.id, 'necessary') // 改标记
    expect(reviewedList(db, L, '2026-11')[1]!.review).toBe('necessary')
  })

  it('旧版本的 值/一般/悔/跳过 迁移成 必要/没复盘/非必要/没复盘，并标记待同步', () => {
    const ids = [expense('外出就餐', 1), expense('外出就餐', 2), expense('外出就餐', 3), expense('外出就餐', 4)]
    ;['worth', 'ok', 'regret', 'skip'].forEach((v, i) =>
      db.update(txnsT).set({ review: v, dirty: false }).where(eq(txnsT.id, ids[i]!)).run(),
    )
    expect(migrateLegacyReviews(db)).toBe(4)
    const rows = ids.map((id) => db.select().from(txnsT).where(eq(txnsT.id, id)).get()!)
    expect(rows.map((r) => r.review)).toEqual(['necessary', null, 'unnecessary', null])
    expect(rows.every((r) => r.dirty)).toBe(true)
    expect(migrateLegacyReviews(db)).toBe(0)
  })
})

describe('账目与家当联动', () => {
  it('计入家当：生成家当；改金额同步买价；关掉开关删掉家当', () => {
    const id = expense('数码', 600_000, { asset: { name: '手机' } })
    const assetId = getTxn(db, id)!.assetId!
    expect(getAsset(db, assetId)).toMatchObject({ name: '手机', costCents: 600_000, fromTxn: true })

    updateTxn(db, id, tx({ type: 'expense', amountCents: 550_000, categoryId: C['数码']!, asset: { name: '新手机' } }))
    expect(getAsset(db, assetId)).toMatchObject({ name: '新手机', costCents: 550_000 })

    updateTxn(db, id, tx({ type: 'expense', amountCents: 550_000, categoryId: C['数码']! }))
    expect(getAsset(db, assetId)).toBeUndefined()
    expect(getTxn(db, id)!.assetId).toBeNull()
  })

  it('删除支出连家当一起删；家当已出手则不让删', () => {
    const a = expense('数码', 100_000, { asset: { name: '耳机' } })
    deleteTxn(db, a)
    expect(listAssets(db, L)).toHaveLength(0)

    const b = expense('数码', 100_000, { asset: { name: '相机' } })
    const assetId = getTxn(db, b)!.assetId!
    expect(deleteBlocker(db, b)).toBeNull() // 持有中可以删
    endAsset(db, assetId, 'lost', '2026-11-12')
    expect(deleteBlocker(db, b)).toMatch(/已经出手/) // 左滑删除前就能说明原因
    expect(() => deleteTxn(db, b)).toThrow(DomainError)
    expect(() =>
      updateTxn(db, b, tx({ type: 'expense', amountCents: 1, categoryId: C['数码']!, asset: { name: '相机' } })),
    ).toThrow(DomainError)
  })

  it('卖出 → 变卖收入进钱袋；卖出生成的收入不能直接删；撤销恢复', () => {
    const id = createAsset(db, L, { name: '自行车', costCents: 100_000, acquiredOn: '2026-01-01', note: '' })
    expect(() => sellAsset(db, id, { priceCents: 1, date: '2025-12-31', walletId: W['现金']! })).toThrow('早于')
    sellAsset(db, id, { priceCents: 40_000, date: '2026-11-15', walletId: W['现金']! })

    expect(balance('现金')).toBe(40_000)
    expect(getAsset(db, id)).toMatchObject({ status: 'sold', soldCents: 40_000, endedOn: '2026-11-15' })
    const sale = listMonthTxns(db, L, '2026-11').find((x) => x.assetId === id)!
    expect(sale.categoryName).toBe('变卖')
    expect(deleteBlocker(db, sale.id)).toMatch(/撤销卖出/)
    expect(() => deleteTxn(db, sale.id)).toThrow(DomainError)
    expect(() => deleteAsset(db, id)).toThrow(DomainError)

    undoAssetEnd(db, id)
    expect(balance('现金')).toBe(0)
    expect(getAsset(db, id)).toMatchObject({ status: 'holding', soldCents: null, endedOn: null })
    deleteAsset(db, id)
    expect(listAssets(db, L)).toHaveLength(0)
  })

  it('删除由支出生成的家当：支出保留，只是不再算家当', () => {
    const id = expense('数码', 300_000, { asset: { name: '平板' } })
    deleteAsset(db, getTxn(db, id)!.assetId!)
    expect(getTxn(db, id)!.assetId).toBeNull()
    expect(monthSummary(db, L, '2026-11', true).expenseCents).toBe(300_000)
  })

  it('使用次数', () => {
    const id = createAsset(db, L, { name: '咖啡机', costCents: 200_000, acquiredOn: '2026-01-01', note: '' })
    addUse(db, id)
    addUse(db, id)
    expect(getAsset(db, id)!.useCount).toBe(2)
    setUseCount(db, id, 10)
    expect(getAsset(db, id)!.useCount).toBe(10)
  })
})

describe('旧版图标迁移', () => {
  it('lucide:* 改成复古图标并标记待同步；只迁移一次', () => {
    const id = defaultId(L, 'expense.taxi')
    db.update(categoriesT).set({ icon: 'lucide:car-taxi-front', dirty: false }).where(eq(categoriesT.id, id)).run()
    const custom = createCategory(db, L, { name: '猫粮', icon: { kind: 'char', char: '猫' }, color: 'zheshi', tier: 'flex', type: 'expense' })
    db.update(categoriesT).set({ icon: 'lucide:no-such-icon' }).where(eq(categoriesT.id, custom)).run()
    expect(migrateLegacyIcons(db)).toBe(2)
    const rows = db.select().from(categoriesT).all()
    expect(rows.find((r) => r.id === id)).toMatchObject({ icon: 'retro:rickshaw', dirty: true })
    expect(rows.find((r) => r.id === custom)?.icon).toBe('retro:cat')
    expect(migrateLegacyIcons(db)).toBe(0)
  })
})

describe('分类管理', () => {
  it('合并：账目转过去，原分类消失；不同类型不能合并', () => {
    const id = createCategory(db, L, { name: '奶茶', icon: { kind: 'retro', name: 'lidded-cup' }, color: 'zheshi', tier: 'want', type: 'expense' })
    const t = createTxn(db, L, tx({ type: 'expense', amountCents: 1_800, categoryId: id }))
    mergeCategory(db, id, C['零食饮品']!)
    expect(getTxn(db, t)!.categoryId).toBe(C['零食饮品'])
    expect(listCategories(db, L).map((c) => c.name)).not.toContain('奶茶')
    expect(() => mergeCategory(db, C['买菜']!, C['工资']!)).toThrow(DomainError)
  })

  it('隐藏：记账时不出现；排序', () => {
    setCategoryHidden(db, C['烟酒']!, true)
    expect(listCategories(db, L, { type: 'expense' }).map((c) => c.name)).not.toContain('烟酒')
    const ids = listCategories(db, L, { type: 'income' }).map((c) => c.id).reverse()
    reorderCategories(db, ids)
    expect(listCategories(db, L, { type: 'income' }).map((c) => c.id)).toEqual(ids)
  })

  it('印章字只能一个字；名称最多 8 个字', () => {
    const base = { color: 'mo' as const, tier: null, type: 'income' as const }
    expect(() => createCategory(db, L, { ...base, name: '分红', icon: { kind: 'char', char: '分红' } })).toThrow(DomainError)
    expect(() => createCategory(db, L, { ...base, name: '一二三四五六七八九', icon: { kind: 'char', char: '一' } })).toThrow(DomainError)
  })
})

describe('搜索', () => {
  it('按备注、分类名、金额', () => {
    expense('外出就餐', 3_250, { note: '和老王吃火锅' })
    expense('打车', 1_800)
    expect(searchTxns(db, L, '火锅')).toHaveLength(1)
    expect(searchTxns(db, L, '打车')).toHaveLength(1)
    expect(searchTxns(db, L, '32.5')).toHaveLength(1)
    expect(searchTxns(db, L, '%')).toHaveLength(0)
  })
})

describe('账本与同步字段', () => {
  it('首次启动只建一个个人账本；再次调用不重复', () => {
    expect(ensurePersonalLedger(db)).toBe(L)
    expect(listLedgers(db)).toEqual([{ id: L, name: '我的账本', type: 'personal', remote: false, myRole: null, cover: null }])
  })

  it('默认分类、钱袋的 id 由账本 id 决定：同一账本在两台设备上生成的一样', async () => {
    const other = await makeTestDb()
    const id = '6f1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e'
    createLedger(db, { id, name: '家', type: 'family' })
    createLedger(other.db, { id, name: '家', type: 'family' })
    const ids = (d: DB) => listCategories(d, id, { includeHidden: true }).map((c) => c.id)
    expect(ids(db)).toEqual(ids(other.db))
    expect(ids(db)).toContain(defaultId(id, 'expense.dining'))
    expect(listWallets(db, id).map((w) => [w.name, w.id])).toEqual([['家用', defaultId(id, 'wallet.family')]])
    // 不同账本的默认分类 id 不同
    expect(ids(db)).not.toContain(C['外出就餐'])
  })

  it('多账本里的一本：默认钱袋和个人账本一样；排序是 主账本 → 多账本 → 家庭账本', () => {
    const fam = createLedger(db, { name: '家', type: 'family' })
    const book = createLedger(db, { name: '装修', type: 'book' })
    expect(listWallets(db, book).map((w) => w.name)).toEqual(['现金', '银行卡', '支付宝', '微信'])
    expect(listLedgers(db).map((l) => l.id)).toEqual([L, book, fam])
  })

  it('账本之间互不可见：统计、钱袋、转账校验都按账本隔离', () => {
    const fam = createLedger(db, { name: '家', type: 'family' })
    const famWallet = listWallets(db, fam)[0]!.id
    createTxn(db, fam, tx({ type: 'expense', amountCents: 100, categoryId: defaultId(fam, 'expense.dining'), walletId: famWallet }))
    expect(monthSummary(db, L, '2026-11').expenseCents).toBe(0)
    expect(monthSummary(db, fam, '2026-11').expenseCents).toBe(100)
    // 不能用别的账本的钱袋或分类记账
    expect(() => expense('外出就餐', 100, { walletId: famWallet })).toThrow(DomainError)
    expect(() => createTxn(db, fam, tx({ type: 'expense', amountCents: 1, categoryId: C['外出就餐']!, walletId: famWallet }))).toThrow(DomainError)
  })

  it('每次写入都标记 dirty、更新 updated_at；删除只打标记', () => {
    const clean = () => {
      for (const t of [walletsT, categoriesT, txnsT, assetsT]) db.update(t).set({ dirty: false }).run()
    }
    const id = expense('数码', 1000, { asset: { name: '鼠标' } })
    const row = () => db.select().from(txnsT).where(eq(txnsT.id, id)).get()!
    expect(row().dirty).toBe(true)
    clean()
    const before = row().updatedAt
    setReview(db, id, 'necessary')
    expect(row().dirty).toBe(true)
    expect(row().updatedAt).toBeGreaterThanOrEqual(before)
    clean()
    deleteTxn(db, id)
    expect(row().deletedAt).not.toBeNull()
    expect(row().dirty).toBe(true)
    const asset = db.select().from(assetsT).all()[0]!
    expect(asset.deletedAt).not.toBeNull()
    expect(asset.dirty).toBe(true)
  })

  it('记账人和“谁花的”', () => {
    const id = createTxn(db, L, tx({ type: 'expense', amountCents: 1, categoryId: C['买菜']!, memberId: 'm-1' }), 'user-1')
    expect(getTxn(db, id)).toMatchObject({ createdBy: 'user-1', memberId: 'm-1' })
    expect(getTxn(db, expense('买菜', 1))).toMatchObject({ createdBy: null, memberId: null })
  })
})

describe('删了能撤销', () => {
  it('一笔账连同一起删掉的家当回来；早先单独删的家当不跟着回来', () => {
    const id = expense('数码', 600_000, { asset: { name: '手机' } })
    const assetId = getTxn(db, id)!.assetId!
    const before = balance('银行卡')
    deleteTxn(db, id)
    expect(getTxn(db, id)).toBeUndefined()
    expect(getAsset(db, assetId)).toBeUndefined()
    restoreTxn(db, id)
    expect(getTxn(db, id)).toMatchObject({ amountCents: 600_000 })
    expect(getAsset(db, assetId)).toMatchObject({ name: '手机' })
    expect(balance('银行卡')).toBe(before)
    restoreTxn(db, id) // 没删的再恢复一次也没事
    expect(getTxn(db, id)).toBeDefined()
  })

  it('删标签：撤销后账上的标签原样回来（顺序也不变）', () => {
    const a = expense('外出就餐', 3_800, { tags: ['报销', '云南旅行'] })
    const b = expense('打车', 1_000, { tags: ['云南旅行'] })
    const snap = deleteTag(db, L, '云南旅行')
    expect(getTxn(db, a)!.tags).toEqual(['报销'])
    expect(getTxn(db, b)!.tags).toEqual([])
    restoreTags(db, snap)
    expect(getTxn(db, a)!.tags).toEqual(['报销', '云南旅行'])
    expect(getTxn(db, b)!.tags).toEqual(['云南旅行'])
  })
})

describe('标签', () => {
  it('记上、改账时不传就保留、按标签查（不分月份）、搜索能找到', () => {
    const a = expense('外出就餐', 3_800, { note: '过桥米线', tags: [' 云南旅行', '云南旅行', '报销'] })
    expense('打车', 4_600, { date: '2026-10-03', tags: ['云南旅行'] })
    expense('打车', 1_000)
    expect(getTxn(db, a)!.tags).toEqual(['云南旅行', '报销'])
    updateTxn(db, a, tx({ type: 'expense', amountCents: 4_000, categoryId: C['外出就餐']!, note: '过桥米线' }))
    expect(getTxn(db, a)!.tags).toEqual(['云南旅行', '报销'])
    expect(listTagTxns(db, L, '云南旅行').map((x) => x.amountCents)).toEqual([4_000, 4_600])
    expect(listTagTxns(db, L, '云南')).toHaveLength(0) // 精确匹配，不是包含
    expect(searchTxns(db, L, '报销')).toHaveLength(1)
    // 10 月那笔不在这个区间里；一样多时谁先谁后不重要
    const nov = tagTotalsIn(db, L, '2026-11-01', '2026-12-01')
    expect(nov).toHaveLength(2)
    expect(nov).toEqual(
      expect.arrayContaining([
        { name: '云南旅行', spendCents: 4_000, incomeCents: 0, count: 1 },
        { name: '报销', spendCents: 4_000, incomeCents: 0, count: 1 },
      ]),
    )
    expect(recentTags(db, L)).toEqual(expect.arrayContaining(['云南旅行', '报销']))
  })

  it('最多 3 个、每个最多 10 个字', () => {
    expect(() => expense('打车', 100, { tags: ['a', 'b', 'c', 'd'] })).toThrow(DomainError)
    expect(() => expense('打车', 100, { tags: ['一二三四五六七八九十一'] })).toThrow(DomainError)
  })

  it('改名（改成已有的就合并）、删除：账和常记都跟着改，账本身不删', async () => {
    const { createTemplate, getTemplate, recordTemplate } = await import('./templateRepo')
    const a = expense('外出就餐', 100, { tags: ['云南', '云南旅行'] })
    const b = expense('打车', 200, { tags: ['云南'] })
    const tp = createTemplate(db, L, { name: '打车', type: 'expense', categoryId: C['打车']!, amountCents: 200, walletId: W['现金']!, note: '', memberId: null, tags: ['云南'] })
    expect(getTxn(db, recordTemplate(db, tp, null))!.tags).toEqual(['云南'])
    renameTag(db, L, '云南', '云南旅行')
    expect(getTxn(db, a)!.tags).toEqual(['云南旅行'])
    expect(getTxn(db, b)!.tags).toEqual(['云南旅行'])
    expect(getTemplate(db, tp)!.tags).toEqual(['云南旅行'])
    expect(allTagTotals(db, L).map((t) => t.name)).toEqual(['云南旅行'])
    renameTag(db, L, '云南旅行', null)
    expect(getTxn(db, a)!.tags).toEqual([])
    expect(countTxns(db, L)).toBe(3)
    expect(() => renameTag(db, L, '报销', '  ')).toThrow(DomainError)
  })

  it('导出再导入：标签还在；旧备份没有标签也能导', () => {
    expense('外出就餐', 100, { tags: ['报销'] })
    const file = exportLedger(db, L)
    expect(file.transactions[0]!.tags).toBe('["报销"]')
    const old = { ...file, transactions: file.transactions.map(({ tags: _, ...r }) => r) }
    importLedger(db, L, parseBackup(JSON.stringify(old)))
    expect(listMonthTxns(db, L, '2026-11')[0]!.tags).toEqual([])
    importLedger(db, L, parseBackup(JSON.stringify(file)))
    expect(listMonthTxns(db, L, '2026-11')[0]!.tags).toEqual(['报销'])
  })
})

describe('导出 / 导入（按账本）', () => {
  const fill = () => {
    createTxn(db, L, tx({ type: 'income', amountCents: 500_000, categoryId: C['工资']! }))
    expense('数码', 300_000, { asset: { name: '手机' } })
    const custom = createCategory(db, L, { name: '奶茶', icon: { kind: 'retro', name: 'lidded-cup' }, color: 'zheshi', tier: 'want', type: 'expense' })
    createTxn(db, L, tx({ type: 'expense', amountCents: 1_800, categoryId: custom }))
  }

  it('导进另一台设备的个人账本（id 不同）：数据一致，默认分类 id 按新账本重算', async () => {
    fill()
    const json = JSON.stringify(exportLedger(db, L))
    const other = await makeTestDb()
    importLedger(other.db, other.ledgerId, parseBackup(json))
    const ow = listWallets(other.db, other.ledgerId)
    expect(ow.find((w) => w.name === '银行卡')!.balanceCents).toBe(500_000 - 300_000 - 1_800)
    expect(ow.find((w) => w.name === '银行卡')!.id).toBe(defaultId(other.ledgerId, 'wallet.bank'))
    expect(listAssets(other.db, other.ledgerId)).toHaveLength(1)
    const s = monthSummary(other.db, other.ledgerId, '2026-11')
    expect(s.categories.map((c) => c.name)).toEqual(['数码', '奶茶'])
    // 新账本里没有任何一条记录沿用旧 id
    const oldIds = new Set([...listMonthTxns(db, L, '2026-11').map((t) => t.id)])
    expect(listMonthTxns(other.db, other.ledgerId, '2026-11').some((t) => oldIds.has(t.id))).toBe(false)
    // 买家当的支出仍然连着家当
    expect(listMonthTxns(other.db, other.ledgerId, '2026-11').find((t) => t.assetId)!.assetId).toBe(listAssets(other.db, other.ledgerId)[0]!.id)
  })

  it('导回原账本：覆盖当前数据，保留 id', () => {
    fill()
    const file = exportLedger(db, L)
    expense('买菜', 999) // 导出之后新记的，导入后应消失
    importLedger(db, L, parseBackup(JSON.stringify(file)))
    expect(countTxns(db, L)).toBe(3)
    expect(listMonthTxns(db, L, '2026-11').map((t) => t.id).sort()).toEqual(file.transactions.map((t) => t.id).sort())
  })

  it('同一个文件导进同设备的另一个账本，不影响原账本', () => {
    fill()
    const fam = createLedger(db, { name: '家', type: 'family' })
    importLedger(db, fam, parseBackup(JSON.stringify(exportLedger(db, L))))
    expect(countTxns(db, fam)).toBe(3)
    expect(countTxns(db, L)).toBe(3)
  })

  it('不合法的文件给出明确提示，原数据不变', () => {
    expense('买菜', 100)
    expect(() => parseBackup('not json')).toThrow('不是账房的备份文件')
    expect(() => parseBackup('{"app":"zhangfang","version":99}')).toThrow('升级')
    const bad = { ...exportLedger(db, L), transactions: [{ id: 1 }] }
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('损坏')
    expect(countTxns(db, L)).toBe(1)
  })
})

describe('常记', () => {
  it('新建、点一下按今天记一笔、撤销；排序；导出导入带上常记', async () => {
    const { createTemplate, listTemplates, recordTemplate, reorderTemplates, undoRecord, templateFromTxn } = await import('./templateRepo')
    const a = createTemplate(db, L, { name: '理发', type: 'expense', categoryId: C['日用']!, amountCents: 3000, walletId: W['现金']!, note: '', memberId: null })
    const b = createTemplate(db, L, { name: '上班交通', type: 'expense', categoryId: C['通勤']!, amountCents: 200, walletId: W['现金']!, note: '地铁', memberId: null })
    expect(listTemplates(db, L).map((t) => t.name)).toEqual(['理发', '上班交通'])
    reorderTemplates(db, [b, a])
    expect(listTemplates(db, L).map((t) => t.name)).toEqual(['上班交通', '理发'])

    const txnId = recordTemplate(db, b, null)
    expect(getTxn(db, txnId)).toMatchObject({ amountCents: 200, note: '地铁', walletId: W['现金'], type: 'expense' })
    undoRecord(db, txnId)
    expect(getTxn(db, txnId)).toBeUndefined()

    expect(() => createTemplate(db, L, { name: ' ', type: 'expense', categoryId: C['日用']!, amountCents: 1, walletId: W['现金']!, note: '', memberId: null })).toThrow(DomainError)
    const x = expense('外出就餐', 1800, { note: '午饭' })
    expect(templateFromTxn(db, x)).toMatchObject({ name: '午饭', amountCents: 1800, categoryId: C['外出就餐'] })

    const other = createLedger(db, { name: '装修', type: 'book' })
    importLedger(db, other, exportLedger(db, L))
    const copied = listTemplates(db, other)
    expect(copied.map((t) => t.name)).toEqual(['上班交通', '理发'])
    expect(copied[0]!.categoryId).toBe(defaultId(other, 'expense.commute')) // 引用换成新账本的分类
  })

  it('存为常记：同名同类型就更新，否则新建', async () => {
    const { listTemplates, saveTemplateByName } = await import('./templateRepo')
    const v = { name: '理发', type: 'expense' as const, categoryId: C['日用']!, amountCents: 3000, walletId: W['现金']!, note: '', memberId: null }
    saveTemplateByName(db, L, v)
    saveTemplateByName(db, L, { ...v, name: ' 理发 ', amountCents: 3500 })
    saveTemplateByName(db, L, { ...v, type: 'income', categoryId: C['工资'] ?? C['日用']! })
    const list = listTemplates(db, L)
    expect(list.filter((t) => t.type === 'expense').map((t) => [t.name, t.amountCents])).toEqual([['理发', 3500]])
    expect(list).toHaveLength(2)
  })
})

describe('周期记账', () => {
  const rent = (more: Partial<Parameters<typeof createRecurring>[2]> = {}) =>
    createRecurring(db, L, {
      type: 'expense',
      categoryId: C['住房']!,
      amountCents: 300_000,
      walletId: W['银行卡']!,
      note: '房租',
      freq: 'month',
      startDate: '2026-09-05',
      endDate: null,
      day: null,
      month: null,
      ...more,
    })
  const recurringTxns = (ledger = L) => db.select().from(txnsT).all().filter((x) => x.ledgerId === ledger && x.recurringId && !x.deletedAt)

  it('补记到今天；再跑不重复；删掉的不补回来；自动记的不算“记过账”', () => {
    const id = rent()
    expect(runDueRecurrings(db, L, '2026-11-20', null)).toEqual({ recorded: 3, paused: [] })
    expect(recurringTxns().map((x) => x.date).sort()).toEqual(['2026-09-05', '2026-10-05', '2026-11-05'])
    expect(getRecurring(db, id)!.doneThrough).toBe('2026-11-05')
    expect(runDueRecurrings(db, L, '2026-11-20', null).recorded).toBe(0)

    deleteTxn(db, recurringTxnId(id, '2026-11-05'))
    setRecurringPaused(db, id, false, '2026-11-20') // 不会把删掉的那笔补回来
    expect(runDueRecurrings(db, L, '2026-12-05', null).recorded).toBe(1)
    expect(recurringTxns()).toHaveLength(3)
    expect(getTxn(db, recurringTxnId(id, '2026-12-05'))).toMatchObject({ amountCents: 300_000, note: '房租', recurringId: id })

    expect(recordedDays(db)).not.toContain('2026-12-05')
    expect(isDayCounted(db, '2026-12-05')).toBe(false)
    expect(listRecurrings(db, L, '2026-12-06')[0]).toMatchObject({ next: '2027-01-05', categoryName: '住房', walletName: '银行卡' })
  })

  it('暂停期间不记，恢复后从今天接着记；结束日之后不记；删掉周期，记过的账留着', () => {
    const id = rent({ startDate: '2026-11-01', freq: 'day', endDate: '2026-11-30' })
    runDueRecurrings(db, L, '2026-11-03', null) // 1、2、3 号
    setRecurringPaused(db, id, true, '2026-11-03')
    expect(runDueRecurrings(db, L, '2026-11-10', null).recorded).toBe(0)
    setRecurringPaused(db, id, false, '2026-11-10')
    expect(runDueRecurrings(db, L, '2026-11-10', null).recorded).toBe(1) // 只有 10 号
    expect(runDueRecurrings(db, L, '2026-12-31', null).recorded).toBe(20) // 11–30 号
    deleteRecurring(db, id)
    expect(listRecurrings(db, L, '2026-12-31')).toEqual([])
    expect(recurringTxns()).toHaveLength(24)
  })

  it('钱袋不在了：这条先暂停，告诉是哪条；校验金额、结束日', () => {
    const id = rent({ walletId: W['微信']! })
    deleteWallet(db, W['微信']!)
    expect(runDueRecurrings(db, L, '2026-11-20', null)).toEqual({ recorded: 0, paused: ['房租'] })
    expect(getRecurring(db, id)!.paused).toBe(true)
    expect(() => rent({ amountCents: 0 })).toThrow(DomainError)
    expect(() => rent({ endDate: '2026-01-01' })).toThrow('结束日期不能早于开始日期')
  })

  it('从一笔账设成周期：这一笔算这一期的，之后的补记到今天；转账不能设', () => {
    const t = expense('住房', 300_000, { date: '2026-10-01', note: '房租' })
    const id = recurringFromTxn(db, L, t, { freq: 'month', day: null, month: null })!
    expect(getRecurring(db, id)).toMatchObject({ startDate: '2026-10-01', doneThrough: '2026-10-31', amountCents: 300_000, note: '房租' })
    expect(runDueRecurrings(db, L, '2026-11-20', null).recorded).toBe(1) // 只补 11-01，10-01 那笔就是刚记的
    expect(recurringTxns().map((x) => x.date)).toEqual(['2026-11-01'])
    // 11-20 记的选“每月 25 号”：这笔算 11 月的，下次 12-25
    const t2 = expense('住房', 100_000, { date: '2026-11-20', note: '车位' })
    const id2 = recurringFromTxn(db, L, t2, { freq: 'month', day: 25, month: null })!
    expect(runDueRecurrings(db, L, '2026-11-30', null).recorded).toBe(0)
    expect(listRecurrings(db, L, '2026-11-30').find((r) => r.id === id2)).toMatchObject({ next: '2026-12-25', day: 25 })
    const move = createTxn(db, L, tx({ type: 'transfer', amountCents: 100, toWalletId: W['微信']! }))
    expect(draftFromTxn(db, move)).toBeUndefined()
    expect(recurringFromTxn(db, L, move, { freq: 'month', day: null, month: null })).toBeUndefined()
    expect(() => createRecurring(db, L, { ...draftFromTxn(db, t)!, day: 8, freq: 'week' })).toThrow('重复的日子不对')
  })

  it('备份带上周期账和自动记的账，不带照片', () => {
    const id = rent()
    runDueRecurrings(db, L, '2026-09-30', null)
    const t = recurringTxnId(id, '2026-09-05')
    setTxnPhoto(db, t, 'file:///x.jpg')
    const file = parseBackup(JSON.stringify(exportLedger(db, L)))
    expect(file.recurrings).toHaveLength(1)
    expect(file.transactions.find((x) => x.id === t)).toMatchObject({ recurringId: id, photo: null })
    const other = createLedger(db, { name: '另一本', type: 'book' })
    importLedger(db, other, file)
    const [r] = listRecurrings(db, other, '2026-09-30')
    expect(r).toMatchObject({ note: '房租', doneThrough: '2026-09-05' })
    expect(recurringTxns(other)[0]!.recurringId).toBe(r!.id)
  })
})
