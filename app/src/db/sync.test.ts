import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RemoteLedger, SyncRequest, SyncResponse } from '../types/api'
import { touched, type DB } from './core'
import { createLedger, getLedger, listLedgers, listMembers } from './ledgerRepo'
import { transactions, wallets } from './schema'
import { defaultId } from './seed'
import { applyResponse, bindPersonalLedger, collectDirty, hasDirty, resetForLogout, runSync, setRemote } from './sync'
import { makeTestDb } from './testDb'
import { createTxn } from './txnRepo'

let db: DB
let L: string

beforeEach(async () => {
  ;({ db, ledgerId: L } = await makeTestDb())
})

const remote = (id: string, type: 'personal' | 'family' = 'personal', more: Partial<RemoteLedger> = {}): RemoteLedger => ({
  id,
  name: type === 'family' ? '王家' : '我的账本',
  type,
  myRole: 'admin',
  members: [{ id: `${id.slice(0, 8)}-0000-4000-8000-000000000001`, userId: 'u1', nickname: '我', role: 'admin', elderMode: false, isMe: true, joinedAt: '2026-11-01T00:00:00Z' }],
  createdAt: '2026-11-01T00:00:00Z',
  ...more,
})
const empty = { wallets: [], categories: [], transactions: [], assets: [], budgets: [], dayMarks: [], templates: [], goals: [], recurrings: [] }
const response = (ledgers: RemoteLedger[], more: Partial<SyncResponse> = {}): SyncResponse => ({
  ledgers,
  changes: { ...empty },
  cursors: Object.fromEntries(ledgers.map((l) => [l.id, 0])),
  hasMore: false,
  rejected: [],
  ...more,
})
const spend = (ledgerId: string, note = '', walletKey = 'wallet.bank') =>
  createTxn(
    db,
    ledgerId,
    {
      type: 'expense',
      amountCents: 1250,
      categoryId: defaultId(ledgerId, 'expense.dining'),
      walletId: defaultId(ledgerId, walletKey),
      toWalletId: null,
      date: '2026-11-17',
      note,
      asset: null,
    },
    'u1',
  )
const txnRow = (id: string) => db.select().from(transactions).where(eq(transactions.id, id)).get()!

describe('推送', () => {
  it('只推服务器上已有的账本；成功后清掉 dirty、游标前移', async () => {
    const id = spend(L, '火锅')
    expect(collectDirty(db).sent).toEqual([]) // 还没绑定到账号
    setRemote(db, L, true)
    const reqs: SyncRequest[] = []
    await runSync(db, async (req) => {
      reqs.push(req)
      return response([remote(L)], { cursors: { [L]: 42 } })
    })
    expect(reqs[0]!.changes.transactions!.map((r) => r.id)).toEqual([id])
    expect(reqs[0]!.changes.transactions![0]!.data).toMatchObject({ note: '火锅', amountCents: 1250, createdBy: 'u1' })
    expect(reqs[0]!.changes.transactions![0]!.data).not.toHaveProperty('dirty')
    expect(txnRow(id).dirty).toBe(false)
    expect(hasDirty(db)).toBe(false)
    expect(getLedger(db, L)?.remote).toBe(true)
    let cursors: Record<string, number> = {}
    await runSync(db, async (req) => {
      cursors = req.cursors
      return response([remote(L)])
    })
    expect(cursors).toEqual({ [L]: 42 })
  })

  it('上传途中又改了：保持 dirty，下次再传', async () => {
    setRemote(db, L, true)
    const id = spend(L)
    await runSync(db, async () => {
      db.update(transactions).set({ note: '改过', ...touched(), updatedAt: Date.now() + 1000 }).where(eq(transactions.id, id)).run()
      return response([remote(L)])
    })
    expect(txnRow(id).dirty).toBe(true)
  })

  it('被拒绝为 forbidden 的保留 dirty；conflict / invalid 不再重试', async () => {
    setRemote(db, L, true)
    const a = spend(L)
    const b = spend(L)
    await runSync(db, async () =>
      response([remote(L)], {
        rejected: [
          { entity: 'transactions', id: a, reason: 'forbidden' },
          { entity: 'transactions', id: b, reason: 'conflict' },
        ],
      }),
    )
    expect(txnRow(a).dirty).toBe(true)
    expect(txnRow(b).dirty).toBe(false)
  })

  it('hasMore 时继续拉，直到没有更多', async () => {
    setRemote(db, L, true)
    let calls = 0
    await runSync(db, async () => response([remote(L)], { hasMore: ++calls < 3 }))
    expect(calls).toBe(3)
  })
})

describe('应用服务器数据', () => {
  it('服务器更新的覆盖本地；本地改过且更新的保留', () => {
    setRemote(db, L, true)
    const id = spend(L, '本地')
    const local = txnRow(id)
    const server = (updatedAt: number, note: string) => ({
      id,
      ledgerId: L,
      updatedAt,
      deletedAt: null,
      data: { ...local, note, id: undefined, ledgerId: undefined, updatedAt: undefined, deletedAt: undefined, dirty: undefined },
    })
    applyResponse(db, response([remote(L)], { changes: { ...empty, transactions: [server(local.updatedAt - 1, '旧的')] } }), [])
    expect(txnRow(id)).toMatchObject({ note: '本地', dirty: true })
    applyResponse(db, response([remote(L)], { changes: { ...empty, transactions: [server(local.updatedAt + 1, '新的')] } }), [])
    expect(txnRow(id)).toMatchObject({ note: '新的', dirty: false })
  })

  it('新账本、新成员随同步下来；缺字段的脏数据跳过', () => {
    const F = '7a1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e'
    const bad = { id: '8a1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e', ledgerId: F, updatedAt: 1, deletedAt: null, data: { name: '缺 kind' } }
    applyResponse(db, response([remote(L), remote(F, 'family')], { changes: { ...empty, wallets: [bad] } }), [])
    expect(listLedgers(db).map((l) => [l.type, l.remote])).toEqual([
      ['personal', true],
      ['family', true],
    ])
    expect(listMembers(db, F)).toHaveLength(1)
    expect(db.select().from(wallets).where(eq(wallets.ledgerId, F)).all()).toEqual([])
  })

  it('不在列表里的家庭账本从本机删除；个人账本只停止同步', () => {
    const F = '7a1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e'
    createLedger(db, { id: F, name: '王家', type: 'family', remote: true })
    spend(F, '', 'wallet.family')
    const r = applyResponse(db, response([]), [])
    expect(r.removed).toEqual([F])
    expect(getLedger(db, F)).toBeUndefined()
    expect(db.select().from(transactions).where(eq(transactions.ledgerId, F)).all()).toEqual([])
    expect(getLedger(db, L)).toMatchObject({ remote: false })
  })

  it('管理员远程开启长辈模式：只在变成开启时通知一次', () => {
    const on = remote(L, 'personal', { members: [{ ...remote(L).members[0]!, elderMode: true }] })
    expect(applyResponse(db, response([on]), []).elderOn).toBe(true)
    expect(applyResponse(db, response([on]), []).elderOn).toBe(false)
  })
})

describe('登录时对上个人账本', () => {
  const S = '9b1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e'
  const deps = (list: RemoteLedger[], over: Partial<Parameters<typeof bindPersonalLedger>[2]> = {}) => ({
    listRemote: async () => list,
    createRemote: async (v: { id: string; name: string }) => remote(v.id, 'personal', { name: v.name }),
    choose: async () => 'merge' as const,
    isIdTaken: () => false,
    ...over,
  })

  it('云端没有：用本机 id 创建，全部待上传', async () => {
    db.update(transactions).set({ dirty: false }).run()
    spend(L)
    db.update(wallets).set({ dirty: false }).run()
    expect(await bindPersonalLedger(db, L, deps([]))).toBe(L)
    expect(getLedger(db, L)?.remote).toBe(true)
    expect(collectDirty(db).sent.length).toBeGreaterThan(30) // 默认分类、钱袋、账目
  })

  it('id 被别的账号占用：换新 id 再建', async () => {
    let first = true
    const id = await bindPersonalLedger(
      db,
      L,
      deps([], {
        createRemote: async (v) => {
          if (first) {
            first = false
            throw new Error('taken')
          }
          return remote(v.id)
        },
        isIdTaken: () => true,
      }),
    )
    expect(id).not.toBe(L)
    expect(getLedger(db, L)).toBeUndefined()
    expect(getLedger(db, id)?.remote).toBe(true)
  })

  it('云端已有、本机没记过：直接用云端的，不问', async () => {
    let asked = false
    const id = await bindPersonalLedger(db, L, deps([remote(S)], { choose: async () => ((asked = true), 'merge') }))
    expect(id).toBe(S)
    expect(asked).toBe(false)
    expect(getLedger(db, L)).toBeUndefined()
  })

  it('合并：本机记录搬到云端账本，默认分类、钱袋按新账本重算 id', async () => {
    const t = spend(L, '本机的账')
    const id = await bindPersonalLedger(db, L, deps([remote(S)]))
    expect(id).toBe(S)
    expect(getLedger(db, L)).toBeUndefined()
    const moved = db.select().from(transactions).where(eq(transactions.ledgerId, S)).all()
    expect(moved).toHaveLength(1)
    expect(moved[0]).toMatchObject({
      note: '本机的账',
      categoryId: defaultId(S, 'expense.dining'),
      walletId: defaultId(S, 'wallet.bank'),
      dirty: true,
    })
    expect(moved[0]!.id).not.toBe(t)
  })

  it('覆盖：本机数据删除，等云端同步下来', async () => {
    spend(L)
    const id = await bindPersonalLedger(db, L, deps([remote(S)], { choose: async () => 'overwrite' }))
    expect(id).toBe(S)
    expect(db.select().from(transactions).all()).toEqual([])
    expect(getLedger(db, S)).toMatchObject({ remote: true })
  })

  it('退出登录：家庭账本、多账本删除，主账本保留但不再同步', () => {
    setRemote(db, L, true)
    createLedger(db, { id: S, name: '王家', type: 'family', remote: true })
    createLedger(db, { id: '0d3c2b1a-4e5f-4a6b-9c7d-8e9f0a1b2c3d', name: '装修', type: 'book', remote: true })
    resetForLogout(db)
    expect(listLedgers(db)).toEqual([{ id: L, name: '我的账本', type: 'personal', remote: false, myRole: null, cover: null }])
  })
})
