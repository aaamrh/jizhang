import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeApp, uuid, type TestApp } from './helpers.js'

let t: TestApp
beforeAll(async () => { t = await makeApp() })
afterAll(() => t.close())

const createLedger = (token: string, type: 'personal' | 'book' | 'family', id = uuid(), name = type === 'family' ? '王家' : '我的账本') =>
  t.call('POST', '/api/ledgers', { id, name, type }, token)

describe('个人账本', () => {
  it('id 用客户端的；只能有一个；创建者是管理员', async () => {
    const u = await t.newUser()
    const id = uuid()
    const r = await createLedger(u.token, 'personal', id)
    expect(r.body).toMatchObject({ id, type: 'personal', myRole: 'admin', members: [{ role: 'admin', isMe: true }] })
    expect((await createLedger(u.token, 'personal')).body.error).toBe('personal_exists')
    expect((await t.call('DELETE', `/api/ledgers/${id}`, undefined, u.token)).status).toBe(400) // 个人账本不能解散
  })
})

describe('多账本（已停用）', () => {
  // 产品改为只有"我的账本 + 家庭账本"（见 docs/决策.md），不能再新建多账本；已有的旧账本照常可见、可删除
  it('新建 400；已有的旧多账本照常可见、只有自己能看、可以删除；主账本不能删', async () => {
    const u = await t.newUser()
    await t.grantVip(u.user.id)
    const r = await createLedger(u.token, 'book', uuid(), '装修')
    expect(r.status).toBe(400)
    expect(r.body).toMatchObject({ error: 'invalid_input', message: '不再支持多账本' })

    const old = uuid()
    await t.pg.query(`insert into ledgers (id, name, type, owner_id) values ($1, '装修', 'book', $2)`, [old, u.user.id])
    await t.pg.query(`insert into ledger_members (ledger_id, user_id, nickname, role) values ($1, $2, 'x', 'admin')`, [old, u.user.id])
    const main = uuid()
    await createLedger(u.token, 'personal', main)
    expect((await t.call('GET', '/api/ledgers', undefined, u.token)).body.map((l: any) => l.type).sort()).toEqual(['book', 'personal'])
    expect((await t.call('POST', `/api/ledgers/${old}/invites`, {}, u.token)).status).toBe(400)
    const other = await t.newUser()
    expect((await t.call('PATCH', `/api/ledgers/${old}`, { name: 'x' }, other.token)).status).toBe(404)
    expect((await t.call('DELETE', `/api/ledgers/${old}`, undefined, u.token)).status).toBe(204)
    expect((await t.call('DELETE', `/api/ledgers/${main}`, undefined, u.token)).body.message).toBe('主账本不能删除')
  })
})

describe('家庭账本', () => {
  // 可以建好几个（细节见 family.test.ts）
  it('需要大掌柜；可以建好几个', async () => {
    const u = await t.newUser()
    expect((await createLedger(u.token, 'family')).body.error).toBe('vip_required')
    await t.grantVip(u.user.id)
    expect((await createLedger(u.token, 'family')).status).toBe(200)
    expect((await createLedger(u.token, 'family')).status).toBe(200)
  })

  it('邀请 → 预览 → 加入；家人档案被认领；重复加入 409；退出、移除', async () => {
    const boss = await t.newUser()
    await t.grantVip(boss.user.id)
    const lid = (await createLedger(boss.token, 'family')).body.id
    const mom = (await t.call('POST', `/api/ledgers/${lid}/members`, { nickname: '妈妈' }, boss.token)).body
    expect(mom).toMatchObject({ role: 'profile', userId: null })

    const inv = (await t.call('POST', `/api/ledgers/${lid}/invites`, { profileMemberId: mom.id }, boss.token)).body
    expect(inv.code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/)
    expect(inv.url).toBe(`https://zf.example.com/i/${inv.code}`)

    const preview = (await t.call('GET', `/api/invites/${inv.code.toLowerCase()}`)).body // 大小写不敏感
    expect(preview).toMatchObject({ ledgerName: '王家', profileNickname: '妈妈', memberCount: 2 })

    const real = await t.newUser()
    const joined = await t.call('POST', `/api/invites/${inv.code}/accept`, undefined, real.token)
    expect(joined.body.members).toHaveLength(2) // 认领档案，不新增人数
    expect(joined.body.members.find((m: any) => m.isMe)).toMatchObject({ id: mom.id, nickname: '妈妈', role: 'member' })
    expect((await t.call('POST', `/api/invites/${inv.code}/accept`, undefined, real.token)).body.error).toBe('already_member')

    // 成员只能改自己；管理员可以远程开长辈模式
    expect((await t.call('PATCH', `/api/ledgers/${lid}/members/${mom.id}`, { elderMode: true }, boss.token)).body.elderMode).toBe(true)
    const bossMember = joined.body.members.find((m: any) => !m.isMe)
    expect((await t.call('PATCH', `/api/ledgers/${lid}/members/${bossMember.id}`, { nickname: 'x' }, real.token)).status).toBe(403)

    const third = await t.newUser()
    await t.call('POST', `/api/invites/${inv.code}/accept`, undefined, third.token)
    expect((await t.call('POST', `/api/ledgers/${lid}/leave`, undefined, third.token)).status).toBe(204)
    expect((await t.call('GET', '/api/ledgers', undefined, third.token)).body).toEqual([])
    expect((await t.call('POST', `/api/ledgers/${lid}/leave`, undefined, boss.token)).status).toBe(400) // 管理员不能退出

    expect((await t.call('DELETE', `/api/ledgers/${lid}/members/${mom.id}`, undefined, boss.token)).status).toBe(204)
    expect((await t.call('GET', `/api/ledgers`, undefined, real.token)).body).toEqual([])
    // 管理员这边仍能看到她的名字（历史账目用），但标记为已离开
    const after = (await t.call('GET', '/api/ledgers', undefined, boss.token)).body.find((l: any) => l.id === lid)
    expect(after.members.find((m: any) => m.id === mom.id)).toMatchObject({ nickname: '妈妈', removed: true, isMe: false })
  })

  it('封面：创建时可带，管理员可改、可清空；成员不能改；邀请预览带封面；非法值 400', async () => {
    const boss = await t.newUser()
    await t.grantVip(boss.user.id)
    const lid = uuid()
    const r = await t.call('POST', '/api/ledgers', { id: lid, name: '一家人', type: 'family', cover: 'lantern' }, boss.token)
    expect(r.body).toMatchObject({ cover: 'lantern' })
    expect((await t.call('PATCH', `/api/ledgers/${lid}`, { cover: 'plum' }, boss.token)).body).toMatchObject({ cover: 'plum', name: '一家人' })
    expect((await t.call('PATCH', `/api/ledgers/${lid}`, { cover: 'Bad Name!' }, boss.token)).status).toBe(400)
    const inv = (await t.call('POST', `/api/ledgers/${lid}/invites`, {}, boss.token)).body
    expect((await t.call('GET', `/api/invites/${inv.code}`)).body).toMatchObject({ cover: 'plum', ledgerName: '一家人' })
    const kid = await t.newUser()
    await t.call('POST', `/api/invites/${inv.code}/accept`, undefined, kid.token)
    expect((await t.call('PATCH', `/api/ledgers/${lid}`, { cover: 'cat' }, kid.token)).status).toBe(403)
    expect((await t.call('PATCH', `/api/ledgers/${lid}`, { cover: null }, boss.token)).body.cover).toBeNull()
  })

  it('满 10 人；作废的、过期的邀请无效；东家过期不能再邀请', async () => {
    const boss = await t.newUser()
    await t.grantVip(boss.user.id)
    const lid = (await createLedger(boss.token, 'family')).body.id
    for (let i = 0; i < 9; i++) await t.call('POST', `/api/ledgers/${lid}/members`, { nickname: `家人${i}` }, boss.token)
    expect((await t.call('POST', `/api/ledgers/${lid}/members`, { nickname: '多一个' }, boss.token)).body.error).toBe('ledger_full')

    const inv = (await t.call('POST', `/api/ledgers/${lid}/invites`, {}, boss.token)).body
    const late = await t.newUser()
    expect((await t.call('POST', `/api/invites/${inv.code}/accept`, undefined, late.token)).body.error).toBe('ledger_full')

    expect((await t.call('DELETE', `/api/ledgers/${lid}/invites/${inv.code}`, undefined, boss.token)).status).toBe(204)
    expect((await t.call('GET', `/api/invites/${inv.code}`)).body.error).toBe('invite_invalid')

    await t.pg.query(`update invites set expires_at = now() - interval '1 day' where ledger_id = $1`, [lid])
    expect((await t.call('GET', `/api/ledgers/${lid}/invites`, undefined, boss.token)).body).toEqual([])

    await t.call('DELETE', `/admin/api/users/${boss.user.id}/vip`, undefined, await t.adminToken())
    expect((await t.call('POST', `/api/ledgers/${lid}/invites`, {}, boss.token)).body.error).toBe('vip_required')
    expect((await t.call('GET', '/api/ledgers', undefined, boss.token)).body).toHaveLength(1) // 已有账本照常使用
  })

  it('非成员看不到账本；落地页转义用户内容', async () => {
    const boss = await t.newUser()
    await t.grantVip(boss.user.id)
    const lid = (await createLedger(boss.token, 'family', uuid(), '<b>王</b>家')).body.id
    const stranger = await t.newUser()
    expect((await t.call('PATCH', `/api/ledgers/${lid}`, { name: 'x' }, stranger.token)).status).toBe(404)

    const inv = (await t.call('POST', `/api/ledgers/${lid}/invites`, {}, boss.token)).body
    const html = (await t.call('GET', `/i/${inv.code}`)).body as string
    expect(html).toContain('&lt;b&gt;王&lt;/b&gt;家')
    expect(html).toContain(`zhangfang://invite/${inv.code}`)
    expect((await t.call('GET', '/i/AAAAAAAA')).body).toContain('邀请已失效')
  })

  it('注销：家庭账本转给加入最早的成员；没人的账本连数据一起删', async () => {
    const boss = await t.newUser()
    await t.grantVip(boss.user.id)
    const lid = (await createLedger(boss.token, 'family')).body.id
    const solo = (await createLedger(boss.token, 'personal')).body.id // 一人只能有一个家庭账本，没人的账本用主账本代替
    const inv = (await t.call('POST', `/api/ledgers/${lid}/invites`, {}, boss.token)).body
    const heir = await t.newUser()
    await t.call('POST', `/api/invites/${inv.code}/accept`, undefined, heir.token)

    await t.call('DELETE', '/api/me', undefined, boss.token)
    const left = (await t.call('GET', '/api/ledgers', undefined, heir.token)).body
    expect(left).toHaveLength(1)
    expect(left[0]).toMatchObject({ id: lid, myRole: 'admin' })
    expect(left[0].members.filter((m: any) => !m.removed)).toHaveLength(1)
    const rows = await t.pg.query(`select 1 from ledgers where id = $1`, [solo])
    expect(rows.rows).toHaveLength(0)
  })

  it('解散后成员看不到，数据清除', async () => {
    const boss = await t.newUser()
    await t.grantVip(boss.user.id)
    const lid = (await createLedger(boss.token, 'family')).body.id
    await t.call('POST', '/api/sync', { changes: { wallets: [{ id: uuid(), ledgerId: lid, updatedAt: 1, deletedAt: null, data: {} }] } }, boss.token)
    expect((await t.call('DELETE', `/api/ledgers/${lid}`, undefined, boss.token)).status).toBe(204)
    expect((await t.call('GET', '/api/ledgers', undefined, boss.token)).body).toEqual([])
    expect((await t.pg.query(`select 1 from sync_records where ledger_id = $1`, [lid])).rows).toHaveLength(0)
  })
})
