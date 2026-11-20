import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeApp, uuid, type TestApp } from './helpers.js'

let t: TestApp
beforeAll(async () => { t = await makeApp() })
afterAll(() => t.close())

const rec = (ledgerId: string, updatedAt: number, data: Record<string, unknown> = {}, id = uuid()) => ({
  id,
  ledgerId,
  updatedAt,
  deletedAt: null,
  data,
})
const sync = (token: string, body: object) => t.call('POST', '/api/sync', body, token)

async function userWithLedger() {
  const u = await t.newUser()
  const lid = uuid()
  await t.call('POST', '/api/ledgers', { id: lid, name: '我的', type: 'personal' }, u.token)
  return { ...u, lid }
}

describe('同步', () => {
  it('上传后另一台手机能拉到；游标之后不再重复', async () => {
    const u = await userWithLedger()
    const tx = rec(u.lid, 100, { amount: 1250, date: '2026-11-17' })
    const first = (await sync(u.token, { cursors: {}, changes: { transactions: [tx] } })).body
    expect(first.rejected).toEqual([])
    expect(first.changes.transactions).toHaveLength(1)
    expect(first.changes.transactions[0]).toMatchObject({ id: tx.id, version: 1, updatedBy: u.user.id, data: { amount: 1250 } })

    const other = (await sync(u.token, { cursors: {} })).body // 新手机，游标为空
    expect(other.changes.transactions.map((r: any) => r.id)).toEqual([tx.id])
    expect(other.cursors[u.lid]).toBe(1)

    const again = (await sync(u.token, { cursors: other.cursors })).body
    expect(again.changes.transactions).toEqual([])
  })

  it('以修改时间新者为准：旧的上传不覆盖，并把服务器版本返回', async () => {
    const u = await userWithLedger()
    const id = uuid()
    await sync(u.token, { changes: { wallets: [rec(u.lid, 200, { name: '新' }, id)] } })
    const r = (await sync(u.token, { cursors: { [u.lid]: 99 }, changes: { wallets: [rec(u.lid, 100, { name: '旧' }, id)] } })).body
    expect(r.changes.wallets).toEqual([expect.objectContaining({ id, data: { name: '新' } })])

    // 删除也只是一条更新
    await sync(u.token, { changes: { wallets: [{ ...rec(u.lid, 300, { name: '新' }, id), deletedAt: 300 }] } })
    const pulled = (await sync(u.token, { cursors: {} })).body
    expect(pulled.changes.wallets[0]).toMatchObject({ id, deletedAt: 300 })
  })

  it('不是成员的账本 forbidden；同 id 跨账本 conflict；data 过大 invalid', async () => {
    const a = await userWithLedger()
    const b = await userWithLedger()
    const id = uuid()
    await sync(a.token, { changes: { assets: [rec(a.lid, 1, {}, id)] } })
    const r = (await sync(b.token, {
      changes: {
        assets: [rec(a.lid, 1), rec(b.lid, 1, {}, id), rec(b.lid, 1, { blob: 'x'.repeat(17 * 1024) })],
      },
    })).body
    expect(r.rejected.map((x: any) => x.reason).sort()).toEqual(['conflict', 'forbidden', 'invalid'])
    expect((await sync(b.token, { cursors: {} })).body.changes.assets).toEqual([])
  })

  it('一次最多拉 1000 条，hasMore 时继续拉', async () => {
    const u = await userWithLedger()
    for (let i = 0; i < 3; i++) {
      const n = i < 2 ? 500 : 1
      await sync(u.token, { changes: { transactions: Array.from({ length: n }, () => rec(u.lid, 1)) } })
    }
    const p1 = (await sync(u.token, { cursors: {} })).body
    expect(p1.changes.transactions).toHaveLength(1000)
    expect(p1.hasMore).toBe(true)
    const p2 = (await sync(u.token, { cursors: p1.cursors })).body
    expect(p2.changes.transactions).toHaveLength(1)
    expect(p2.hasMore).toBe(false)
  }, 30_000)

  it('一次上传超过 500 条 → 400', async () => {
    const u = await userWithLedger()
    const r = await sync(u.token, { changes: { transactions: Array.from({ length: 501 }, () => rec(u.lid, 1)) } })
    expect(r.status).toBe(400)
  })

  it('家庭账本：成员互相看到；被移除后账本从列表消失、不能再写', async () => {
    const boss = await userWithLedger()
    await t.grantVip(boss.user.id)
    const fid = uuid()
    await t.call('POST', '/api/ledgers', { id: fid, name: '家', type: 'family' }, boss.token)
    const inv = (await t.call('POST', `/api/ledgers/${fid}/invites`, {}, boss.token)).body
    const kid = await userWithLedger()
    await t.call('POST', `/api/invites/${inv.code}/accept`, undefined, kid.token)

    await sync(kid.token, { changes: { transactions: [rec(fid, 5, { note: '买菜' })] } })
    const seen = (await sync(boss.token, { cursors: {} })).body
    expect(seen.changes.transactions.find((r: any) => r.ledgerId === fid)).toMatchObject({ data: { note: '买菜' }, updatedBy: kid.user.id })
    expect(seen.ledgers.map((l: any) => l.id).sort()).toEqual([boss.lid, fid].sort())

    const kidMember = seen.ledgers.find((l: any) => l.id === fid).members.find((m: any) => !m.isMe)
    await t.call('DELETE', `/api/ledgers/${fid}/members/${kidMember.id}`, undefined, boss.token)
    const after = (await sync(kid.token, { cursors: {}, changes: { transactions: [rec(fid, 6)] } })).body
    expect(after.ledgers.map((l: any) => l.id)).toEqual([kid.lid])
    expect(after.rejected[0].reason).toBe('forbidden')
  })

  it('常记（templates）和其他记录一样同步', async () => {
    const u = await userWithLedger()
    const tpl = rec(u.lid, 10, { name: '理发', type: 'expense', amountCents: 3000 })
    expect((await sync(u.token, { changes: { templates: [tpl] } })).body.rejected).toEqual([])
    const pulled = (await sync(u.token, { cursors: {} })).body
    expect(pulled.changes.templates).toEqual([expect.objectContaining({ id: tpl.id, data: { name: '理发', type: 'expense', amountCents: 3000 } })])
  })

  it('攒钱目标（goals）和其他记录一样同步', async () => {
    const u = await userWithLedger()
    const g = rec(u.lid, 10, { name: '旅行基金', targetCents: 2_000_000, status: 'active' })
    expect((await sync(u.token, { changes: { goals: [g] } })).body.rejected).toEqual([])
    const pulled = (await sync(u.token, { cursors: {} })).body
    expect(pulled.changes.goals).toEqual([expect.objectContaining({ id: g.id, data: { name: '旅行基金', targetCents: 2_000_000, status: 'active' } })])
  })

  it('没登录 → 401', async () => {
    expect((await t.call('POST', '/api/sync', { cursors: {} })).status).toBe(401)
  })
})
