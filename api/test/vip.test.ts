import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { priceOf } from '../src/biz/vip.biz.js'
import type { Product, User } from '../src/models/schema.js'
import { makeApp, type TestApp } from './helpers.js'

let t: TestApp
let admin: string
beforeAll(async () => {
  t = await makeApp()
  admin = await t.adminToken()
})
afterAll(() => t.close())

const DAY = 86_400_000

describe('价格', () => {
  const p = { priceCents: 4500, promoPriceCents: 3800, promoStart: null, promoEnd: null, badge: '限时', newUserPriceCents: 2800 } as Product
  const user = (ageDays: number) => ({ createdAt: new Date(Date.now() - ageDays * DAY) }) as User

  it('活动价、新人价（7 天内且没付过费）取低', () => {
    expect(priceOf(p, null, false)).toEqual({ priceCents: 3800, badge: '限时' })
    expect(priceOf(p, user(1), false)).toEqual({ priceCents: 2800, badge: '新人价' })
    expect(priceOf(p, user(8), false).priceCents).toBe(3800)
    expect(priceOf(p, user(1), true).priceCents).toBe(3800)
  })

  it('活动过期恢复原价；未开始也是原价', () => {
    const past = { ...p, promoEnd: new Date(Date.now() - DAY), newUserPriceCents: null }
    const future = { ...p, promoStart: new Date(Date.now() + DAY), newUserPriceCents: null }
    expect(priceOf(past, null, false).priceCents).toBe(4500)
    expect(priceOf(future, null, false).priceCents).toBe(4500)
  })

  it('接口：默认方案；连续包年只在 iOS 显示', async () => {
    const android = (await t.call('GET', '/api/vip/products?platform=android')).body
    expect(android.map((x: any) => x.id)).toEqual(['month', 'year', 'three_year'])
    expect(android.find((x: any) => x.id === 'year')).toMatchObject({ priceCents: 3800, originalPriceCents: 4500 })
    const ios = (await t.call('GET', '/api/vip/products?platform=ios')).body
    expect(ios.map((x: any) => x.id)).toContain('year_auto')
    const fresh = await t.newUser()
    const mine = (await t.call('GET', '/api/vip/products?platform=android', undefined, fresh.token)).body
    expect(mine.find((x: any) => x.id === 'year')).toMatchObject({ priceCents: 2800, badge: '新人价' })
  })
})

describe('订单', () => {
  it('模拟支付 → 东家 +365 天；重复支付只生效一次；付过费后不再是新人价', async () => {
    const u = await t.newUser()
    const o = (await t.call('POST', '/api/orders', { productId: 'year', channel: 'mock' }, u.token)).body
    expect(o).toMatchObject({ amountCents: 2800, status: 'pending' })
    await t.call('POST', `/api/orders/${o.orderId}/mock-pay`, undefined, u.token)
    const me1 = (await t.call('GET', '/api/me', undefined, u.token)).body
    expect(me1.isVip).toBe(true)
    await t.call('POST', `/api/orders/${o.orderId}/mock-pay`, undefined, u.token)
    const me2 = (await t.call('GET', '/api/me', undefined, u.token)).body
    expect(me2.vipUntil).toBe(me1.vipUntil)
    expect(Math.round((Date.parse(me1.vipUntil) - Date.now()) / DAY)).toBe(365)

    const o2 = (await t.call('POST', '/api/orders', { productId: 'month', channel: 'mock' }, u.token)).body
    await t.call('POST', `/api/orders/${o2.orderId}/mock-pay`, undefined, u.token)
    const me3 = (await t.call('GET', '/api/me', undefined, u.token)).body
    expect(Math.round((Date.parse(me3.vipUntil) - Date.parse(me1.vipUntil)) / DAY)).toBe(30) // 累加
    expect((await t.call('GET', '/api/vip/products?platform=android', undefined, u.token)).body.find((x: any) => x.id === 'year').priceCents).toBe(3800)
  })

  it('真实渠道未开通 → 501；别人的订单 404；下架的方案 404', async () => {
    const u = await t.newUser()
    expect((await t.call('POST', '/api/orders', { productId: 'year', channel: 'wechat' }, u.token)).status).toBe(501)
    const o = (await t.call('POST', '/api/orders', { productId: 'year', channel: 'mock' }, u.token)).body
    const other = await t.newUser()
    expect((await t.call('GET', `/api/orders/${o.orderId}`, undefined, other.token)).status).toBe(404)
    await t.call('PATCH', '/admin/api/products/month', { active: false }, admin)
    expect((await t.call('POST', '/api/orders', { productId: 'month', channel: 'mock' }, u.token)).status).toBe(404)
    await t.call('PATCH', '/admin/api/products/month', { active: true }, admin)
  })

  it('后台补单、退款（扣回天数，最多扣到现在），都要写原因', async () => {
    const u = await t.newUser()
    const o = (await t.call('POST', '/api/orders', { productId: 'month', channel: 'mock' }, u.token)).body
    expect((await t.call('POST', `/admin/api/orders/${o.orderId}/mark-paid`, { note: '' }, admin)).status).toBe(400)
    expect((await t.call('POST', `/admin/api/orders/${o.orderId}/mark-paid`, { note: '客服核实到账' }, admin)).body.status).toBe('paid')
    expect((await t.call('GET', '/api/me', undefined, u.token)).body.isVip).toBe(true)

    expect((await t.call('POST', `/admin/api/orders/${o.orderId}/refund`, { note: '用户申请' }, admin)).body.status).toBe('refunded')
    const me = (await t.call('GET', '/api/me', undefined, u.token)).body
    expect(me.isVip).toBe(false)
    expect((await t.call('POST', `/admin/api/orders/${o.orderId}/refund`, { note: '再退' }, admin)).status).toBe(400)

    const list = (await t.call('GET', '/admin/api/orders?status=refunded', undefined, admin)).body
    expect(list.items.map((x: any) => x.id)).toContain(o.orderId)
  })

  it('后台改活动价；概览里有收入和东家人数', async () => {
    const r = await t.call(
      'PATCH',
      '/admin/api/products/three_year',
      { promoPriceCents: 8800, promoEnd: new Date(Date.now() + DAY).toISOString(), badge: '双11' },
      admin,
    )
    expect(r.body).toMatchObject({ promoPriceCents: 8800, badge: '双11' })
    expect((await t.call('GET', '/api/vip/products?platform=android')).body.find((x: any) => x.id === 'three_year')).toMatchObject({
      priceCents: 8800,
      badge: '双11',
    })
    const s = (await t.call('GET', '/admin/api/stats', undefined, admin)).body
    expect(s.revenue.todayCents).toBeGreaterThan(0)
    expect(s.users.vip).toBeGreaterThan(0)
    expect(s.users.paying).toBeGreaterThan(0)
  })
})

describe('后台用户', () => {
  it('按手机号或昵称搜索；开通、撤销东家', async () => {
    const u = await t.newUser('13512345678')
    await t.call('PATCH', '/api/me', { nickname: '张三丰' }, u.token)
    expect((await t.call('GET', '/admin/api/users?q=12345', undefined, admin)).body.items[0]).toMatchObject({ phone: '13512345678' })
    expect((await t.call('GET', `/admin/api/users?q=${encodeURIComponent('三丰')}`, undefined, admin)).body.total).toBe(1)
    expect((await t.call('GET', '/admin/api/users?q=%25', undefined, admin)).body.total).toBe(0) // % 当普通字符

    await t.call('POST', `/admin/api/users/${u.user.id}/vip`, { days: 10 }, admin)
    expect((await t.call('GET', '/api/me', undefined, u.token)).body.isVip).toBe(true)
    await t.call('DELETE', `/admin/api/users/${u.user.id}/vip`, undefined, admin)
    expect((await t.call('GET', '/api/me', undefined, u.token)).body.isVip).toBe(false)
  })
})
