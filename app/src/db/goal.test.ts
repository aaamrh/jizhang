import { beforeEach, describe, expect, it } from 'vitest'
import type { TxnInput } from '../types/domain'
import { exportLedger, importLedger } from './backup'
import { DomainError, type DB } from './core'
import { archiveGoal, checkGoals, createGoal, listGoals, updateGoal } from './goalRepo'
import { createLedger } from './ledgerRepo'
import { monthSummary } from './statsRepo'
import { makeTestDb } from './testDb'
import { createTxn } from './txnRepo'
import { listWallets } from './walletRepo'

let db: DB
let L: string
let bank: string

beforeEach(async () => {
  ;({ db, ledgerId: L } = await makeTestDb())
  bank = listWallets(db, L).find((w) => w.name === '银行卡')!.id
})

const transfer = (from: string, to: string, cents: number, date = '2026-11-10') =>
  createTxn(db, L, { type: 'transfer', amountCents: cents, categoryId: null, walletId: from, toWalletId: to, date, note: '', asset: null } as TxnInput)

describe('攒钱目标', () => {
  it('立目标同时建储钱罐；储钱罐不出现在普通钱袋列表里', () => {
    const id = createGoal(db, L, { name: '年底旅行', targetCents: 500_000, deadline: '2026-12-31' }, '2026-11-01')
    const g = listGoals(db, L).find((x) => x.id === id)!
    expect(g).toMatchObject({ name: '年底旅行', status: 'active', balanceCents: 0, createdOn: '2026-11-01' })
    expect(listWallets(db, L).some((w) => w.id === g.walletId)).toBe(false)
    expect(listWallets(db, L, true, true).find((w) => w.id === g.walletId)?.kind).toBe('jar')
  })

  it('存进储钱罐是转账：不算支出；存满即达成，冻结日期和金额；之后取出不撤销', () => {
    const id = createGoal(db, L, { name: '手机', targetCents: 300_000, deadline: null }, '2026-08-01')
    const jar = listGoals(db, L)[0]!.walletId
    transfer(bank, jar, 200_000)
    expect(checkGoals(db, L, '2026-11-10')).toEqual([])
    transfer(bank, jar, 120_000)
    expect(checkGoals(db, L, '2026-11-12')).toEqual([id])
    expect(checkGoals(db, L, '2026-11-12')).toEqual([]) // 只达成一次
    transfer(jar, bank, 320_000)
    const g = listGoals(db, L)[0]!
    expect(g).toMatchObject({ status: 'achieved', achievedOn: '2026-11-12', achievedCents: 320_000, balanceCents: 0 })
    expect(monthSummary(db, L, '2026-11').expenseCents).toBe(0)
  })

  it('免费同时只能进行 1 个；放弃后可以再立；达成或放弃的不能改', () => {
    const a = createGoal(db, L, { name: 'A', targetCents: 1000, deadline: null }, '2026-11-01', 1)
    expect(() => createGoal(db, L, { name: 'B', targetCents: 1000, deadline: null }, '2026-11-01', 1)).toThrow(DomainError)
    archiveGoal(db, a)
    createGoal(db, L, { name: 'B', targetCents: 1000, deadline: null }, '2026-11-01', 1)
    expect(() => updateGoal(db, L, a, { name: 'A2', targetCents: 1000, deadline: null })).toThrow(DomainError)
    expect(() => createGoal(db, L, { name: '', targetCents: 1000, deadline: null }, '2026-11-01')).toThrow(DomainError)
  })

  it('导出导入（换账本）后目标和储钱罐引用一并保留', () => {
    createGoal(db, L, { name: '旅行', targetCents: 100_000, deadline: null }, '2026-11-01')
    transfer(bank, listGoals(db, L)[0]!.walletId, 40_000)
    const other = createLedger(db, { name: '新账本', type: 'book' })
    importLedger(db, other, exportLedger(db, L))
    const g = listGoals(db, other)[0]!
    expect(g).toMatchObject({ name: '旅行', balanceCents: 40_000 })
  })
})

describe('攒够 → 圆梦', () => {
  it('没攒够不能圆梦；攒够后圆梦一次，记下日期、一句话；不能重复', async () => {
    const { fulfillGoal } = await import('./goalRepo')
    const id = createGoal(db, L, { name: '看海', targetCents: 50_000, deadline: null }, '2026-10-01')
    expect(() => fulfillGoal(db, L, id, { wish: '', photo: null }, '2026-11-01')).toThrow(DomainError)
    transfer(bank, listGoals(db, L)[0]!.walletId, 50_000)
    checkGoals(db, L, '2026-11-01')
    expect(listGoals(db, L)[0]).toMatchObject({ status: 'achieved', fulfilledOn: null })
    fulfillGoal(db, L, id, { wish: '  海风很好  ', photo: 'file:///local.jpg' }, '2026-11-20')
    expect(listGoals(db, L)[0]).toMatchObject({ fulfilledOn: '2026-11-20', wish: '海风很好', photo: 'file:///local.jpg' })
    expect(() => fulfillGoal(db, L, id, { wish: '', photo: null }, '2026-11-21')).toThrow(DomainError)
    // 照片只在本机：导出时不带
    expect(exportLedger(db, L).goals?.[0]?.photo).toBeNull()
  })
})

describe('延期', () => {
  it('进行中的目标可以改期限；攒够的不能', async () => {
    const { postponeGoal } = await import('./goalRepo')
    const id = createGoal(db, L, { name: '换车', targetCents: 100_000, deadline: '2026-10-01' }, '2026-08-01')
    postponeGoal(db, L, id, '2027-02-18')
    expect(listGoals(db, L)[0]!.deadline).toBe('2027-02-18')
    transfer(bank, listGoals(db, L)[0]!.walletId, 100_000)
    checkGoals(db, L, '2026-11-18')
    expect(() => postponeGoal(db, L, id, '2027-05-18')).toThrow(DomainError)
  })
})
