import { readFileSync } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Biz } from '../biz/index.js'
import type { Env } from '../config/env.js'
import { requireAdmin } from '../plugins/auth.js'
import { VERSION_RE } from '../utils/version.js'

const page = readFileSync(new URL('../../admin/index.html', import.meta.url))

const idParams = z.object({ id: z.uuid() })
const paging = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}
const note = z.object({ note: z.string().trim().min(1, '请填写原因').max(200) })
const cents = z.number().int().min(0).max(10_000_000)
const time = z.iso.datetime({ offset: true }).transform((s) => new Date(s))

const releaseBody = z.object({
  latestVersion: z.string().regex(VERSION_RE),
  minVersion: z.string().regex(VERSION_RE),
  notes: z.string().max(2000).default(''),
  downloadUrl: z.url({ protocol: /^https?$/ }).nullable().default(null),
})

const productPatch = z
  .object({
    name: z.string().trim().min(1).max(20),
    days: z.number().int().min(1).max(3660),
    priceCents: cents,
    promoPriceCents: cents.nullable(),
    promoStart: time.nullable(),
    promoEnd: time.nullable(),
    badge: z.string().trim().max(10).nullable(),
    newUserPriceCents: cents.nullable(),
    appleProductId: z.string().trim().max(100).nullable(),
    active: z.boolean(),
    sort: z.number().int(),
  })
  .partial()

export function registerAdminController(app: FastifyInstance, biz: Biz, env: Env) {
  const guard = { preHandler: requireAdmin }

  app.get('/admin', async (_req, reply) =>
    reply
      .type('text/html; charset=utf-8')
      .header('x-frame-options', 'DENY')
      .header('referrer-policy', 'no-referrer')
      .send(page),
  )

  app.post(
    '/admin/api/login',
    { config: { rateLimit: { max: env.ADMIN_LOGIN_PER_MIN, timeWindow: '1 minute' } } },
    async (req) => {
      const body = z.object({ password: z.string().min(1).max(200) }).parse(req.body)
      biz.admin.checkPassword(body.password)
      return { token: app.jwt.sign({ role: 'admin' }, { expiresIn: '12h' }) }
    },
  )

  app.get('/admin/api/stats', guard, () => biz.admin.stats())

  // ── 用户 ──
  app.get('/admin/api/users', guard, async (req) => {
    const q = z.object({ q: z.string().max(20).default(''), ...paging }).parse(req.query)
    return biz.admin.listUsers(q)
  })

  app.post('/admin/api/users/:id/vip', guard, async (req) => {
    const { id } = idParams.parse(req.params)
    const { days } = z.object({ days: z.number().int().min(1).max(3660) }).parse(req.body)
    return biz.admin.grantVip(id, days)
  })

  app.delete('/admin/api/users/:id/vip', guard, async (req, reply) => {
    await biz.admin.revokeVip(idParams.parse(req.params).id)
    return reply.code(204).send()
  })

  app.post('/admin/api/users/:id/freeze', guard, async (req, reply) => {
    await biz.admin.setFrozen(idParams.parse(req.params).id, true)
    return reply.code(204).send()
  })

  app.delete('/admin/api/users/:id/freeze', guard, async (req, reply) => {
    await biz.admin.setFrozen(idParams.parse(req.params).id, false)
    return reply.code(204).send()
  })

  // ── 订单 ──
  app.get('/admin/api/orders', guard, async (req) => {
    const q = z.object({ status: z.enum(['pending', 'paid', 'closed', 'refunded']).optional(), ...paging }).parse(req.query)
    return biz.vip.adminOrders(q)
  })

  app.post('/admin/api/orders/:id/mark-paid', guard, async (req) =>
    biz.vip.adminMarkPaid(idParams.parse(req.params).id, note.parse(req.body).note),
  )

  app.post('/admin/api/orders/:id/refund', guard, async (req) =>
    biz.vip.adminRefund(idParams.parse(req.params).id, note.parse(req.body).note),
  )

  // ── 付费方案 ──
  app.get('/admin/api/products', guard, () => biz.vip.adminProducts())

  app.patch('/admin/api/products/:id', guard, async (req) => {
    const { id } = z.object({ id: z.string().min(1).max(32) }).parse(req.params)
    return biz.vip.adminUpdateProduct(id, productPatch.parse(req.body))
  })

  // ── 版本 ──
  app.get('/admin/api/releases', guard, () => biz.release.list())

  app.get('/admin/api/errors', guard, () => biz.device.recentErrors())

  app.put('/admin/api/releases/:platform', guard, async (req) => {
    const { platform } = z.object({ platform: z.enum(['ios', 'android']) }).parse(req.params)
    return biz.release.save(platform, releaseBody.parse(req.body))
  })
}
