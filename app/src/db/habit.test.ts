import { beforeEach, describe, expect, it } from 'vitest'
import { toBudget } from '../mapper/budget'
import type { TxnInput } from '../types/domain'
import { addDays, today } from '../utils/dates'
import { createAsset } from './assetRepo'
import { exportLedger, importLedger, parseBackup } from './backup'
import { budgetId, budgetStatus, listBudgets, setBudget } from './budgetRepo'
import { listCategories, mergeCategory, createCategory } from './categoryRepo'
import { DomainError, type DB } from './core'
import { dayMarkId, hasNoSpend, isDayCounted, recordedDays, setNoSpend } from './dayRepo'
import { createLedger } from './ledgerRepo'
import { hasTxnsInYear, spendSnapshot, weekReport, yearReport } from './reportRepo'
import { budgets as budgetsT, dayMarks as dayMarksT } from './schema'
import { defaultId } from './seed'
import { makeTestDb } from './testDb'
import { createTxn, deleteTxn, setReview } from './txnRepo'
import { listWallets } from './walletRepo'

let db: DB
let L: string
let W: Record<string, string>
let C: Record<string, string>

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

describe('预算', () => {
  it('总预算 + 分类预算：退款冲减，买家当也算花钱，日均可花', () => {
    setBudget(db, L, null, 300_000)
    setBudget(db, L, C['外出就餐']!, 50_000)
    expense('外出就餐', 60_000)
    createTxn(db, L, tx({ type: 'refund', amountCents: 20_000, categoryId: C['外出就餐']! }))
    expense('数码', 100_000, { asset: { name: '耳机' } })
    expense('买菜', 1_000, { date: '2026-10-31' }) // 上个月，不算

    const st = budgetStatus(db, L, '2026-11', '2026-11-17')
    expect(st.total).toMatchObject({ spentCents: 140_000, leftCents: 160_000, daysLeft: 14, perDayCents: 11_428 })
    expect(st.categories).toHaveLength(1)
    expect(st.categories[0]).toMatchObject({ name: '外出就餐', spentCents: 40_000, ratio: 0.8 })
  })

  it('id 由账本和分类决定；清空即取消；再设恢复', () => {
    setBudget(db, L, null, 100)
    expect(listBudgets(db, L).map((b) => b.id)).toEqual([budgetId(L, null)])
    expect(budgetId(L, null)).toBe(defaultId(L, 'budget:total'))
    setBudget(db, L, null, 0)
    expect(listBudgets(db, L)).toHaveLength(0)
    expect(db.select().from(budgetsT).all()[0]!.deletedAt).not.toBeNull() // 软删除，留给同步
    setBudget(db, L, null, 200)
    expect(listBudgets(db, L)).toEqual([{ id: budgetId(L, null), ledgerId: L, categoryId: null, amountCents: 200 }])
    expect(budgetStatus(db, L, '2030-01').total).toMatchObject({ budgetCents: 200 }) // 未来月份
  })

  it('不合法的输入；收入分类不能设；分类合并后它的预算不再显示', () => {
    expect(() => setBudget(db, L, null, -1)).toThrow(DomainError)
    expect(() => setBudget(db, L, null, 1.5)).toThrow(DomainError)
    expect(() => setBudget(db, L, C['工资']!, 100)).toThrow(DomainError)
    const tea = createCategory(db, L, { name: '奶茶', icon: { kind: 'retro', name: 'lidded-cup' }, color: 'zheshi', tier: 'want', type: 'expense' })
    setBudget(db, L, tea, 1000)
    mergeCategory(db, tea, C['零食饮品']!)
    expect(budgetStatus(db, L, '2026-11').categories).toHaveLength(0)
  })

  it('mapper：负数、小数按 0', () => {
    const r = { id: 'b', ledgerId: L, updatedAt: 1, deletedAt: null, dirty: false, categoryId: null }
    expect(toBudget({ ...r, amountCents: -5 }).amountCents).toBe(0)
    expect(toBudget({ ...r, amountCents: 1.2 }).amountCents).toBe(0)
    expect(toBudget({ ...r, amountCents: 300 }).amountCents).toBe(300)
  })
})

describe('记账日与今天没花钱', () => {
  it('任何账本、任何类型的账都算；删除的不算；今天没花钱可撤销', () => {
    const fam = createLedger(db, { name: '家', type: 'family' })
    expense('买菜', 100, { date: '2026-11-01' })
    createTxn(db, L, tx({ type: 'transfer', amountCents: 100, toWalletId: W['现金']!, date: '2026-11-02' }))
    createTxn(db, fam, tx({ type: 'expense', amountCents: 1, categoryId: defaultId(fam, 'expense.dining'), walletId: defaultId(fam, 'wallet.family'), date: '2026-11-03' }))
    const gone = expense('买菜', 100, { date: '2026-11-04' })
    deleteTxn(db, gone)
    setNoSpend(db, L, '2026-11-05', true)
    setNoSpend(db, L, '2026-11-05', true) // 重复点：还是一条
    expect(new Set(recordedDays(db))).toEqual(new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05']))
    expect(db.select().from(dayMarksT).all().map((r) => r.id)).toEqual([dayMarkId(L, '2026-11-05')])
    expect(isDayCounted(db, '2026-11-04')).toBe(false)
    expect(hasNoSpend(db, '2026-11-05')).toBe(true)
    setNoSpend(db, L, '2026-11-05', false)
    expect(isDayCounted(db, '2026-11-05')).toBe(false)
  })
})

describe('周报、年报、小组件', () => {
  it('周：最大一笔、记账天数（汇总、比上周用盘账的 rangeSummary）', () => {
    expense('外出就餐', 3_000, { date: '2026-11-09' }) // 上周一
    expense('外出就餐', 5_000, { date: '2026-11-16' }) // 周一
    expense('数码', 20_000, { date: '2026-11-18', note: '键盘' })
    createTxn(db, L, tx({ type: 'refund', amountCents: 1_000, categoryId: C['外出就餐']!, date: '2026-11-19' }))
    expense('娱乐', 999, { date: '2026-11-23' }) // 下周一
    setNoSpend(db, L, '2026-11-20', true)

    const r = weekReport(db, L, '2026-11-16')
    expect(r.largest).toMatchObject({ amountCents: 20_000, note: '键盘', categoryName: '数码' })
    expect(r.recordDays).toBe(4) // 16、18、19 有账，20 号没花钱
  })

  it('年报：按月、必要性、复盘、家当日均最低、记账天数与最长连续', () => {
    expense('住房', 300_000, { date: '2026-01-05' })
    const a = expense('外出就餐', 10_000, { date: '2026-01-06' })
    const b = expense('游戏', 5_000, { date: '2026-03-01' })
    expense('外出就餐', 1, { date: '2025-12-31' }) // 去年
    setReview(db, a, 'necessary')
    setReview(db, b, 'unnecessary')
    createAsset(db, L, { name: '台灯', costCents: 10_000, acquiredOn: '2026-06-01', note: '' })
    createAsset(db, L, { name: '耳机', costCents: 100_000, acquiredOn: '2026-10-01', note: '' })
    createAsset(db, L, { name: '旧物', costCents: 1, acquiredOn: '2025-01-01', note: '' }) // 不是今年添的

    const r = yearReport(db, L, 2026, '2026-12-31')
    expect(r.summary.expenseCents).toBe(315_000)
    expect(r.months.map((m) => m.expenseCents)).toEqual([310_000, 0, 5_000, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(r.summary.necessity).toEqual({ necessary: 310_000, unnecessary: 5_000, pending: 0 })
    expect(r.summary.reviewed).toBe(2)
    expect(r.assetsAdded).toBe(2)
    expect(r.bestAsset).toMatchObject({ name: '台灯', days: 214, perDayCents: 47 })
    expect(r.recordDays).toBe(3)
    expect(r.longestStreak).toBe(2)
    expect(hasTxnsInYear(db, L, 2025)).toBe(true)
    expect(hasTxnsInYear(db, L, 2024)).toBe(false)
  })

  it('小组件：今日、本月已花', () => {
    const d = today()
    expense('买菜', 1_500, { date: d })
    expense('买菜', 500, { date: addDays(d, -40) }) // 不在本月
    const s = spendSnapshot(db, L, d)
    expect(s.todayCents).toBe(1_500)
    expect(s.monthCents).toBe(1_500) // 40 天前一定不在本月
  })
})

describe('导出导入包含预算和今天没花钱', () => {
  it('导进另一台设备：分类预算跟着新分类 id，标记 id 按新账本重算；旧文件没有这两项也能导', async () => {
    setBudget(db, L, null, 300_000)
    setBudget(db, L, C['外出就餐']!, 50_000)
    setNoSpend(db, L, '2026-11-05', true)
    const file = exportLedger(db, L)
    const other = await makeTestDb()
    importLedger(other.db, other.ledgerId, parseBackup(JSON.stringify(file)))
    const OL = other.ledgerId
    const dining = defaultId(OL, 'expense.dining')
    expect(listBudgets(other.db, OL).map((b) => [b.id, b.categoryId, b.amountCents]).sort()).toEqual(
      [
        [budgetId(OL, null), null, 300_000],
        [budgetId(OL, dining), dining, 50_000],
      ].sort(),
    )
    expect(other.db.select().from(dayMarksT).all().map((r) => r.id)).toEqual([dayMarkId(OL, '2026-11-05')])

    const { budgets: _b, dayMarks: _d, ...old } = file
    const third = await makeTestDb()
    importLedger(third.db, third.ledgerId, parseBackup(JSON.stringify(old)))
    expect(listBudgets(third.db, third.ledgerId)).toHaveLength(0)
  })
})
