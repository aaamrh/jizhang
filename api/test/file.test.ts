import { readdirSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sniffImage } from '../src/utils/image.js'
import { makeApp, uuid, type TestApp } from './helpers.js'

let t: TestApp
beforeAll(async () => { t = await makeApp() })
afterAll(() => t.close())

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)])
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50)])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20)])

const allFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true }).filter((d) => d.isFile()).map((d) => d.name)

async function userWithLedger() {
  const u = await t.newUser()
  const lid = uuid()
  await t.call('POST', '/api/ledgers', { id: lid, name: '我的', type: 'personal' }, u.token)
  return { ...u, lid }
}

describe('照片', () => {
  it('按文件头识别类型，不看声明', () => {
    expect(sniffImage(JPEG)).toBe('image/jpeg')
    expect(sniffImage(PNG)).toBe('image/png')
    expect(sniffImage(WEBP)).toBe('image/webp')
    expect(sniffImage(Buffer.from('<svg></svg>'))).toBeNull()
  })

  it('上传 → 下载内容一致、带缓存头；非图片 400', async () => {
    const u = await userWithLedger()
    const up = await t.upload(u.token, u.lid, JPEG)
    expect(up.status).toBe(200)
    const res = await t.app.inject({ method: 'GET', url: `/api/files/${up.body.id}`, headers: { authorization: `Bearer ${u.token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('image/jpeg')
    expect(res.headers['cache-control']).toContain('private')
    expect(res.rawPayload.equals(JPEG)).toBe(true)

    const bad = await t.upload(u.token, u.lid, Buffer.from('<html>hi</html>'))
    expect(bad.body.error).toBe('unsupported_type')
  })

  it('超过 5MB → 413', async () => {
    const u = await userWithLedger()
    const big = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)])
    expect((await t.upload(u.token, u.lid, big)).status).toBe(413)
  })

  it('不是账本成员：不能传、不能看（404）、不能删', async () => {
    const a = await userWithLedger()
    const b = await userWithLedger()
    expect((await t.upload(b.token, a.lid, JPEG)).status).toBe(404)
    const id = (await t.upload(a.token, a.lid, JPEG)).body.id
    expect((await t.call('GET', `/api/files/${id}`, undefined, b.token)).status).toBe(404)
    expect((await t.call('DELETE', `/api/files/${id}`, undefined, b.token)).status).toBe(404)
    expect((await t.call('GET', `/api/files/${id}`)).status).toBe(401)
  })

  it('家庭账本：成员能看；只有上传者或管理员能删', async () => {
    const boss = await userWithLedger()
    await t.grantVip(boss.user.id)
    const fid = uuid()
    await t.call('POST', '/api/ledgers', { id: fid, name: '家', type: 'family' }, boss.token)
    const inv = (await t.call('POST', `/api/ledgers/${fid}/invites`, {}, boss.token)).body
    const kid = await userWithLedger()
    const kid2 = await userWithLedger()
    await t.call('POST', `/api/invites/${inv.code}/accept`, undefined, kid.token)
    await t.call('POST', `/api/invites/${inv.code}/accept`, undefined, kid2.token)

    const id = (await t.upload(kid.token, fid, PNG)).body.id
    expect((await t.call('GET', `/api/files/${id}`, undefined, boss.token)).status).toBe(200)
    expect((await t.call('DELETE', `/api/files/${id}`, undefined, kid2.token)).status).toBe(403)
    expect((await t.call('DELETE', `/api/files/${id}`, undefined, boss.token)).status).toBe(204)
    expect((await t.call('GET', `/api/files/${id}`, undefined, kid.token)).status).toBe(404)

    // 成员列表带大掌柜标识
    const ledgers = (await t.call('GET', '/api/ledgers', undefined, kid.token)).body
    const members = ledgers.find((l: any) => l.id === fid).members
    expect(members.find((m: any) => m.userId === boss.user.id).isVip).toBe(true)
    expect(members.find((m: any) => m.userId === kid.user.id).isVip).toBe(false)
  })

  it('解散账本、注销账号后，存储里的文件也删掉', async () => {
    const boss = await userWithLedger()
    await t.grantVip(boss.user.id)
    const fid = uuid()
    await t.call('POST', '/api/ledgers', { id: fid, name: '家', type: 'family' }, boss.token)
    const before = allFiles(t.storageDir).length
    const f1 = (await t.upload(boss.token, fid, JPEG)).body.id
    const f2 = (await t.upload(boss.token, boss.lid, JPEG)).body.id
    expect(allFiles(t.storageDir).length).toBe(before + 2)

    await t.call('DELETE', `/api/ledgers/${fid}`, undefined, boss.token)
    expect(allFiles(t.storageDir).length).toBe(before + 1)
    expect((await t.pg.query('select 1 from files where id = $1', [f1])).rows).toHaveLength(0)

    await t.call('DELETE', '/api/me', undefined, boss.token)
    expect(allFiles(t.storageDir).length).toBe(before)
    expect((await t.pg.query('select 1 from files where id = $1', [f2])).rows).toHaveLength(0)
  })
})
