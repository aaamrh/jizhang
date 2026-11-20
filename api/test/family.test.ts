import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeApp, uuid, type TestApp } from './helpers.js'

let t: TestApp
beforeAll(async () => { t = await makeApp() })
afterAll(() => t.close())

type U = Awaited<ReturnType<TestApp['newUser']>> & { lid: string }

/** 新用户 + 自己的主账本 */
async function person(): Promise<U> {
  const u = await t.newUser()
  const lid = uuid()
  await t.call('POST', '/api/ledgers', { id: lid, name: '我的账本', type: 'personal' }, u.token)
  return { ...u, lid }
}

let clock = 1_000
/** 一笔账目，字段和 App 上传的一致 */
const txn = (ledgerId: string, date: string, data: Record<string, unknown> = {}) => ({
  id: uuid(),
  ledgerId,
  updatedAt: ++clock,
  deletedAt: null as number | null,
  data: {
    type: 'expense', amountCents: 1000, categoryId: null, walletId: uuid(), toWalletId: null, date, note: '',
    assetId: null, review: null, createdBy: null, memberId: null, createdAt: clock, ...data,
  },
})
const category = (ledgerId: string, data: Record<string, unknown>) => ({ id: uuid(), ledgerId, updatedAt: ++clock, deletedAt: null, data })

const push = async (u: U, changes: Record<string, unknown[]>) => {
  const r = await t.call('POST', '/api/sync', { cursors: {}, changes }, u.token)
  expect(r.body.rejected).toEqual([])
}
const feed = (u: U, lid: string, start = '2026-01-01', end = '2027-01-01') =>
  t.call('GET', `/api/ledgers/${lid}/family-feed?start=${start}&end=${end}`, undefined, u.token)
const ids = (r: { body: { items: { id: string }[] } }) => r.body.items.map((i) => i.id)

/** 大掌柜建家庭账本，返回账本 id 和一张请帖 */
async function family(boss: U, name = '王家') {
  await t.grantVip(boss.user.id)
  const fid = uuid()
  const r = await t.call('POST', '/api/ledgers', { id: fid, name, type: 'family' }, boss.token)
  expect(r.status).toBe(200)
  const code = (await t.call('POST', `/api/ledgers/${fid}/invites`, {}, boss.token)).body.code as string
  return { fid, code }
}
const accept = (u: U, code: string) => t.call('POST', `/api/invites/${code}/accept`, undefined, u.token)
/** 把某人当前（未离开的）成员身份的加入时间改到指定时刻 */
const setJoined = (fid: string, u: U, at: string) =>
  t.pg.query(`update ledger_members set joined_at = $1 where ledger_id = $2 and user_id = $3 and removed_at is null`, [at, fid, u.user.id])

describe('家庭账本明细（汇总成员各自的账本）', () => {
  it('汇总两人主账本里加入后的收支和退款，带分类；不含转账、已删除、加入前的；旧版家庭账本里的账照样算', async () => {
    const boss = await person()
    const kid = await person()
    const { fid, code } = await family(boss)
    expect((await accept(kid, code)).status).toBe(200)
    await setJoined(fid, boss, '2026-01-01T00:00:00+08:00')
    await setJoined(fid, kid, '2026-03-01T16:30:00Z') // 北京时间 3 月 2 日 00:30 → 从 3 月 2 日起算

    const food = category(boss.lid, { name: '吃饭', icon: 'bowl', color: '#B5322B', tier: 'need' })
    const salary = category(kid.lid, { name: '工资', icon: 'coin', color: '#3F7A55', tier: null })
    const gone = category(kid.lid, { name: '删掉的', icon: 'x', color: '#000' })
    const breakfast = txn(boss.lid, '2026-02-10', { categoryId: food.id, amountCents: 1250, note: '早饭', review: 'necessary', createdBy: boss.user.id })
    const transfer = txn(boss.lid, '2026-02-11', { type: 'transfer', toWalletId: uuid() })
    const deleted = { ...txn(boss.lid, '2026-02-12'), deletedAt: 5 }
    const refund = txn(boss.lid, '2026-02-13', { type: 'refund', amountCents: 300 })
    const tooEarly = txn(boss.lid, '2025-12-31') // 不在查询范围
    await push(boss, { categories: [food], transactions: [breakfast, transfer, deleted, refund, tooEarly] })

    const pay = txn(kid.lid, '2026-03-02', { type: 'income', categoryId: salary.id, amountCents: 500_000 })
    const beforeJoin = txn(kid.lid, '2026-03-01')
    const noCat = txn(kid.lid, '2026-03-05', { categoryId: uuid() })
    const deletedCat = txn(kid.lid, '2026-03-06', { categoryId: gone.id })
    const legacy = txn(fid, '2026-01-05', { createdBy: kid.user.id, note: '旧账' }) // 旧版直接记在家庭账本里，不按加入时间过滤
    await push(kid, { categories: [salary, { ...gone, deletedAt: 9 }], transactions: [pay, beforeJoin, noCat, deletedCat, legacy] })

    const r = await feed(kid, fid)
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ active: true, frozenSince: null })
    expect(ids(r)).toEqual([deletedCat.id, noCat.id, pay.id, refund.id, breakfast.id, legacy.id]) // 日期从新到旧
    expect(r.body.items.find((i: any) => i.id === breakfast.id)).toEqual({
      id: breakfast.id, date: '2026-02-10', type: 'expense', amountCents: 1250, note: '早饭', review: 'necessary',
      createdAt: breakfast.data.createdAt, userId: boss.user.id,
      category: { name: '吃饭', icon: 'bowl', color: '#B5322B', tier: 'need' },
    })
    expect(r.body.items.find((i: any) => i.id === pay.id)).toMatchObject({
      type: 'income', amountCents: 500_000, userId: kid.user.id, category: { name: '工资', tier: null },
    })
    expect(r.body.items.find((i: any) => i.id === noCat.id).category).toBeNull()
    expect(r.body.items.find((i: any) => i.id === deletedCat.id).category).toBeNull()
    expect(r.body.items.find((i: any) => i.id === legacy.id)).toMatchObject({ userId: kid.user.id, note: '旧账' })

    // 同一天按记账时间从新到旧；end 不含
    const later = txn(boss.lid, '2026-02-10', { createdAt: breakfast.data.createdAt + 1 })
    const endDay = txn(boss.lid, '2026-03-01')
    await push(boss, { transactions: [later, endDay] })
    expect(ids(await feed(boss, fid, '2026-02-01', '2026-03-01'))).toEqual([refund.id, later.id, breakfast.id])
  })

  it('被移除的人：在家期间的账留下，离开后的不算；再加入后从新的加入日起算', async () => {
    const boss = await person()
    const kid = await person()
    const { fid, code } = await family(boss)
    await accept(kid, code)
    await setJoined(fid, kid, '2026-01-01T00:00:00+08:00')
    const april = txn(kid.lid, '2026-04-01')
    const gap = txn(kid.lid, '2026-04-20')
    const may = txn(kid.lid, '2026-05-01')
    await push(kid, { transactions: [april, gap, may] })

    const kidMember = (await t.call('GET', '/api/ledgers', undefined, boss.token)).body
      .find((l: any) => l.id === fid).members.find((m: any) => m.userId === kid.user.id)
    expect((await t.call('DELETE', `/api/ledgers/${fid}/members/${kidMember.id}`, undefined, boss.token)).status).toBe(204)
    await t.pg.query(`update ledger_members set removed_at = $1 where id = $2`, ['2026-04-15T10:00:00+08:00', kidMember.id])

    expect(ids(await feed(boss, fid))).toEqual([april.id])
    expect((await feed(kid, fid)).status).toBe(404) // 他自己看不到了

    // 再加入：两段成员身份各算各的
    const code2 = (await t.call('POST', `/api/ledgers/${fid}/invites`, {}, boss.token)).body.code
    expect((await accept(kid, code2)).status).toBe(200)
    await setJoined(fid, kid, '2026-04-30T12:00:00+08:00')
    expect(ids(await feed(boss, fid))).toEqual([may.id, april.id])
    expect(ids(await feed(kid, fid))).toEqual([may.id, april.id])
  })

  it('创建者大掌柜到期：家人 403；创建者能看，家人的账截到到期那天；续费后补齐', async () => {
    const boss = await person()
    const kid = await person()
    const { fid, code } = await family(boss)
    await accept(kid, code)
    await setJoined(fid, boss, '2026-01-01T00:00:00+08:00')
    await setJoined(fid, kid, '2026-01-01T00:00:00+08:00')
    const kidIn = txn(kid.lid, '2026-06-16')
    const kidAfter = txn(kid.lid, '2026-06-17')
    await push(kid, { transactions: [kidIn, kidAfter] })
    const bossAfter = txn(boss.lid, '2026-06-20')
    await push(boss, { transactions: [bossAfter] })

    // 2026-06-15 17:00 UTC = 北京时间 6 月 16 日 01:00
    await t.pg.query(`update users set vip_until = $1 where id = $2`, ['2026-06-15T17:00:00Z', boss.user.id])
    const denied = await feed(kid, fid)
    expect(denied.status).toBe(403)
    expect(denied.body).toMatchObject({ error: 'family_inactive', message: '创建者的大掌柜到期了，暂时看不到家庭账本' })

    const frozen = await feed(boss, fid)
    expect(frozen.status).toBe(200)
    expect(frozen.body).toMatchObject({ active: false, frozenSince: '2026-06-16' })
    expect(ids(frozen)).toEqual([bossAfter.id, kidIn.id]) // 创建者自己的账不截断

    await t.grantVip(boss.user.id)
    const back = await feed(kid, fid)
    expect(back.body).toMatchObject({ active: true, frozenSince: null })
    expect(ids(back)).toEqual([bossAfter.id, kidAfter.id, kidIn.id])
  })

  it('参数和权限：日期非法、start ≥ end、超过一年零一周 400；不是成员 404；不是家庭账本 400', async () => {
    const boss = await person()
    const { fid } = await family(boss)
    expect((await feed(boss, fid, '2026-02-30', '2026-03-01')).status).toBe(400)
    expect((await feed(boss, fid, '2026-03-01', '2026-03-01')).status).toBe(400)
    expect((await feed(boss, fid, '2026-01-01', '2027-01-10')).status).toBe(400)
    expect((await feed(boss, fid, '2025-12-26', '2027-01-03')).status).toBe(200) // 一年 + 前后补的几天
    expect((await t.call('GET', `/api/ledgers/${fid}/family-feed?start=2026-01-01`, undefined, boss.token)).status).toBe(400)
    const stranger = await person()
    expect((await feed(stranger, fid)).status).toBe(404)
    expect((await feed(boss, boss.lid)).status).toBe(400)
    expect((await t.call('GET', `/api/ledgers/${fid}/family-feed?start=2026-01-01&end=2026-02-01`)).status).toBe(401)
  })
})

describe('好几个家庭账本、各自选共享开始日期', () => {
  it('能同时建、同时加入好几个家庭；同一笔账汇进每个家庭；同一个家不能重复加入', async () => {
    const a = await person()
    const b = await person()
    const c = await person()
    const fa = await family(a, '张家')
    const fb = await family(b, '李家')

    const again = await t.call('POST', '/api/ledgers', { id: uuid(), name: '再一个', type: 'family' }, a.token)
    expect(again.status).toBe(200)
    expect((await accept(a, fb.code)).status).toBe(200)
    expect((await accept(c, fb.code)).status).toBe(200)
    expect((await accept(c, fa.code)).status).toBe(200)
    await t.grantVip(c.user.id)
    expect((await t.call('POST', '/api/ledgers', { id: uuid(), name: '小家', type: 'family' }, c.token)).status).toBe(200)
    expect((await accept(c, fb.code)).body.error).toBe('already_member')
    const mine = (await t.call('GET', '/api/ledgers', undefined, c.token)).body as { type: string }[]
    expect(mine.filter((l) => l.type === 'family')).toHaveLength(3)

    await setJoined(fa.fid, c, '2026-01-01T00:00:00+08:00')
    await setJoined(fb.fid, c, '2026-01-01T00:00:00+08:00')
    const x = txn(c.lid, '2026-02-01')
    await push(c, { transactions: [x] })
    expect(ids(await feed(a, fa.fid))).toEqual([x.id])
    expect(ids(await feed(b, fb.fid))).toEqual([x.id])
  })

  it('加入时选的开始日期可以早于加入那天：这天起的账汇进来，之前的不汇；创建者也能选', async () => {
    const boss = await person()
    const kid = await person()
    await t.grantVip(boss.user.id)
    const fid = uuid()
    const created = await t.call('POST', '/api/ledgers', { id: fid, name: '王家', type: 'family', shareFrom: '2026-05-01' }, boss.token)
    expect(created.status).toBe(200)
    expect(created.body.members[0]).toMatchObject({ isMe: true, shareFrom: '2026-05-01' })
    const code = (await t.call('POST', `/api/ledgers/${fid}/invites`, {}, boss.token)).body.code as string

    const joined = await t.call('POST', `/api/invites/${code}/accept`, { shareFrom: '2026-03-01' }, kid.token)
    expect(joined.status).toBe(200)
    expect(joined.body.members.find((m: any) => m.isMe)).toMatchObject({ shareFrom: '2026-03-01' })

    const bossOld = txn(boss.lid, '2026-04-30')
    const bossNew = txn(boss.lid, '2026-05-01')
    await push(boss, { transactions: [bossOld, bossNew] })
    const kidOld = txn(kid.lid, '2026-02-28')
    const kidNew = txn(kid.lid, '2026-03-01')
    await push(kid, { transactions: [kidOld, kidNew] })
    expect(ids(await feed(kid, fid)).sort()).toEqual([bossNew.id, kidNew.id].sort())

    // 没选的（旧版 App）按加入那天
    const other = await person()
    const code2 = (await t.call('POST', `/api/ledgers/${fid}/invites`, {}, boss.token)).body.code as string
    const r = await accept(other, code2)
    const cnToday = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
    expect(r.body.members.find((m: any) => m.isMe).shareFrom).toBe(cnToday)
  })

  it('开始日期不能晚于今天，格式不对 400', async () => {
    const boss = await person()
    const kid = await person()
    await t.grantVip(boss.user.id)
    const late = await t.call('POST', '/api/ledgers', { id: uuid(), name: '王家', type: 'family', shareFrom: '2099-01-01' }, boss.token)
    expect(late.status).toBe(400)
    expect(late.body.message).toBe('开始日期不能晚于今天')
    const { code } = await family(boss)
    expect((await t.call('POST', `/api/invites/${code}/accept`, { shareFrom: '2099-01-01' }, kid.token)).body.message).toBe('开始日期不能晚于今天')
    expect((await t.call('POST', `/api/invites/${code}/accept`, { shareFrom: '2026/03/01' }, kid.token)).status).toBe(400)
  })

  it('不能再新建多账本', async () => {
    const u = await person()
    await t.grantVip(u.user.id)
    const r = await t.call('POST', '/api/ledgers', { id: uuid(), name: '装修', type: 'book' }, u.token)
    expect(r.status).toBe(400)
    expect(r.body).toMatchObject({ error: 'invalid_input', message: '不再支持多账本' })
  })
})
