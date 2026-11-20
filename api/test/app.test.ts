import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compareVersion } from '../src/utils/version.js'
import { makeApp, type TestApp } from './helpers.js'

let t: TestApp
let admin: string
beforeAll(async () => {
  t = await makeApp()
  admin = await t.adminToken()
})
afterAll(() => t.close())

describe('compareVersion', () => {
  it('按数字逐段比较，缺的段当 0', () => {
    expect(compareVersion('1.10.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersion('1.2', '1.2.0')).toBe(0)
    expect(compareVersion('0.9', '1')).toBeLessThan(0)
  })
})

describe('设备上报', () => {
  const id = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b'

  it('同一设备同一天多次上报只算一次；参数不对 → 400', async () => {
    const body = { deviceId: id, platform: 'ios', appVersion: '1.0.0' }
    expect((await t.call('POST', '/api/devices/ping', body)).status).toBe(204)
    const u = await t.newUser()
    expect((await t.call('POST', '/api/devices/ping', { ...body, appVersion: '1.0.1' }, u.token)).status).toBe(204)
    expect((await t.call('POST', '/api/devices/ping', { ...body, deviceId: 'nope' })).status).toBe(400)

    const s = (await t.call('GET', '/admin/api/stats', undefined, admin)).body
    expect(s.devices).toMatchObject({ total: 1, activeToday: 1, new7d: 1, ios: 1, android: 0 })
    expect(s.devices.versions).toEqual([{ version: '1.0.1', count: 1 }])
    expect(s.series).toHaveLength(30)
    expect(s.series.at(-1)).toMatchObject({ active: 1, newDevices: 1, newUsers: 1 })
  })
})

describe('出错上报', () => {
  it('收下出错信息，后台能看到；字段不对、太长、一次太多 → 400', async () => {
    const base = { deviceId: '7c2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b', platform: 'android', appVersion: '1.0.0' }
    const report = { message: 'TypeError: x is undefined', stack: 'at Home (index.js:1:2)', fatal: true, at: Date.now() }
    expect((await t.call('POST', '/api/client-errors', { ...base, reports: [report] })).status).toBe(204)
    expect((await t.call('POST', '/api/client-errors', { ...base, reports: [] })).status).toBe(400)
    expect((await t.call('POST', '/api/client-errors', { ...base, reports: [{ ...report, message: 'x'.repeat(501) }] })).status).toBe(400)
    expect((await t.call('POST', '/api/client-errors', { ...base, reports: Array(21).fill(report) })).status).toBe(400)

    const rows = (await t.call('GET', '/admin/api/errors', undefined, admin)).body
    expect(rows[0]).toMatchObject({ platform: 'android', appVersion: '1.0.0', message: report.message, fatal: true })
    expect((await t.call('GET', '/admin/api/errors')).status).toBe(401)
  })
})

describe('检查更新', () => {
  const check = async (platform: string, current: string) =>
    (await t.call('GET', `/api/app/version?platform=${platform}&current=${current}`)).body

  it('没配置时 → none；低于最低版本 → force；低于最新 → optional', async () => {
    expect((await check('android', '1.0.0')).update).toBe('none')
    const r = await t.call(
      'PUT',
      '/admin/api/releases/android',
      { latestVersion: '1.3.0', minVersion: '1.1', notes: '修复若干问题', downloadUrl: 'https://example.com/zf.apk' },
      admin,
    )
    expect(r.status).toBe(200)
    expect((await check('android', '1.0.9')).update).toBe('force')
    expect((await check('android', '1.2.0')).update).toBe('optional')
    expect((await check('android', '1.3')).update).toBe('none')
    expect((await check('ios', '1.0.0')).update).toBe('none')
  })

  it('最低版本不能高于最新；下载地址必须是网址', async () => {
    const put = (body: object) => t.call('PUT', '/admin/api/releases/ios', body, admin)
    expect((await put({ latestVersion: '1.0', minVersion: '2.0' })).body.message).toBe('最低支持版本不能高于最新版本')
    expect((await put({ latestVersion: '1.0', minVersion: '1.0', downloadUrl: 'javascript:alert(1)' })).status).toBe(400)
  })
})

describe('后台权限', () => {
  it('密码错、没 token、用户 token → 401；管理员 token 不能当用户用', async () => {
    expect((await t.call('POST', '/admin/api/login', { password: 'wrong-password' })).status).toBe(401)
    expect((await t.call('GET', '/admin/api/stats')).status).toBe(401)
    const u = await t.newUser()
    expect((await t.call('GET', '/admin/api/stats', undefined, u.token)).status).toBe(401)
    expect((await t.call('GET', '/api/me', undefined, admin)).status).toBe(401)
  })

  it('后台页面可打开', async () => {
    const r = await t.call('GET', '/admin')
    expect(r.status).toBe(200)
    expect(r.body).toContain('账房')
  })
})
