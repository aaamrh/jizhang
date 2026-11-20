import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeApp, type TestApp } from './helpers.js'

let t: TestApp
let admin: string
beforeAll(async () => {
  t = await makeApp({
    wechat: { exchange: async (c) => (c === 'bad' ? Promise.reject(new Error('x')) : { openid: `o-${c}`, unionid: `u-${c}` }) },
    apple: { verify: async (tok) => (tok === 'bad' ? Promise.reject(new Error('x')) : `apple-${tok}`) },
    onekey: { getPhone: async (tok) => tok },
  })
  admin = await t.adminToken()
})
afterAll(() => t.close())

const send = (phone: string) => t.call('POST', '/api/auth/sms/send', { phone })
const lastCode = (phone: string) => t.sent.filter((s) => s.phone === phone).at(-1)!.code

describe('短信登录', () => {
  it('首次登录自动注册（isNew），再登录是同一个账号；手机号打码', async () => {
    const a = await t.newUser('13800138000')
    expect(a.user).toMatchObject({ phone: '138****8000', providers: ['phone'], isVip: false })
    expect(a.user.nickname).toMatch(/^账友\d{4}$/)
    expect((await t.call('GET', '/api/me', undefined, a.token)).body.id).toBe(a.user.id)
  })

  it('60 秒内重发 → 429；验证码只能用一次；错 5 次锁定；格式不对 → 400', async () => {
    const phone = '13900000001'
    await send(phone)
    expect((await send(phone)).body.error).toBe('sms_too_soon')
    const code = lastCode(phone)
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) {
      expect((await t.call('POST', '/api/auth/sms/login', { phone, code: wrong })).body.error).toBe('sms_invalid')
    }
    expect((await t.call('POST', '/api/auth/sms/login', { phone, code })).body.error).toBe('sms_locked')
    expect((await send('12345')).status).toBe(400)
  })
})

describe('测试环境验证码回显', () => {
  it('非正式环境：发验证码返回 devCode，就是能登录的那个码', async () => {
    const r = await t.call('POST', '/api/auth/sms/send', { phone: '13500000077' })
    expect(r.status).toBe(200)
    expect(r.body.devCode).toBe(lastCode('13500000077'))
    const login = await t.call('POST', '/api/auth/sms/login', { phone: '13500000077', code: r.body.devCode })
    expect(login.status).toBe(200)
  })

  it('SMS_DEV_ECHO=false（正式环境）：只回 204，不带验证码', async () => {
    const prod = await makeApp({}, { SMS_DEV_ECHO: 'false' })
    const r = await prod.call('POST', '/api/auth/sms/send', { phone: '13500000078' })
    expect(r.status).toBe(204)
    expect(r.body).toBeFalsy()
    await prod.close()
  })
})

describe('其他登录方式', () => {
  it('微信：unionid 优先，同一个微信是同一账号；失败 → 401', async () => {
    const a = await t.call('POST', '/api/auth/wechat', { code: 'w1' })
    const b = await t.call('POST', '/api/auth/wechat', { code: 'w1' })
    expect(a.body).toMatchObject({ isNew: true, user: { providers: ['wechat'], phone: null } })
    expect(b.body).toMatchObject({ isNew: false, user: { id: a.body.user.id } })
    expect((await t.call('POST', '/api/auth/wechat', { code: 'bad' })).body.error).toBe('auth_failed')
  })

  it('Apple：可带昵称；一键登录：直接拿到手机号', async () => {
    const a = await t.call('POST', '/api/auth/apple', { identityToken: 'a1', nickname: '小明' })
    expect(a.body.user).toMatchObject({ nickname: '小明', providers: ['apple'] })
    const k = await t.call('POST', '/api/auth/onekey', { token: '13700000009' })
    expect(k.body.user.phone).toBe('137****0009')
  })

  it('未配置的登录方式 → 501', async () => {
    const bare = await makeApp()
    expect((await bare.call('POST', '/api/auth/wechat', { code: 'x' })).status).toBe(501)
    expect((await bare.call('POST', '/api/auth/onekey', { token: 'x' })).status).toBe(501)
    await bare.close()
  })
})

describe('账号', () => {
  it('绑定：微信账号再绑手机号；已被别人占用 → 409；解绑不能解最后一种', async () => {
    const w = (await t.call('POST', '/api/auth/wechat', { code: 'bindme' })).body
    await send('13600000001')
    const bound = await t.call('POST', '/api/me/bind/phone', { phone: '13600000001', code: lastCode('13600000001') }, w.token)
    expect(bound.body.providers).toEqual(['wechat', 'phone'])

    const other = await t.newUser('13600000002')
    const taken = await t.call('POST', '/api/me/bind/wechat', { code: 'bindme' }, other.token)
    expect(taken.body.error).toBe('already_bound')

    expect((await t.call('DELETE', '/api/me/bind/wechat', undefined, w.token)).body.providers).toEqual(['phone'])
    expect((await t.call('DELETE', '/api/me/bind/phone', undefined, w.token)).body.error).toBe('last_provider')
  })

  it('改昵称；冻结后登录和已有 token 都 401；解冻恢复', async () => {
    const u = await t.newUser('13600000003')
    expect((await t.call('PATCH', '/api/me', { nickname: ' 老王 ' }, u.token)).body.nickname).toBe('老王')

    await t.call('POST', `/admin/api/users/${u.user.id}/freeze`, undefined, admin)
    const me = await t.call('GET', '/api/me', undefined, u.token)
    expect(me.status).toBe(401)
    expect(me.body.message).toContain('冻结')
    await t.call('DELETE', '/api/me', undefined, u.token) // 冻结时也不能注销
    await send('13600000003')
    const relogin = await t.call('POST', '/api/auth/sms/login', { phone: '13600000003', code: lastCode('13600000003') })
    expect(relogin.status).toBe(401)
    await t.call('DELETE', `/admin/api/users/${u.user.id}/freeze`, undefined, admin)
    expect((await t.call('GET', '/api/me', undefined, u.token)).status).toBe(200)
  })

  it('注销后 token 失效，同一手机号再登录是新账号', async () => {
    const u = await t.newUser('13600000004')
    expect((await t.call('DELETE', '/api/me', undefined, u.token)).status).toBe(204)
    expect((await t.call('GET', '/api/me', undefined, u.token)).status).toBe(401)
    const again = await t.newUser('13600000004')
    expect(again.user.id).not.toBe(u.user.id)
  })
})
