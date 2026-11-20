import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Biz } from '../biz/index.js'
import type { Env } from '../config/env.js'
import { me, userGuard } from '../plugins/auth.js'
import { credentialParsers } from './auth.controller.js'

const nickname = z.string().trim().min(1).max(20)

export function registerMeController(app: FastifyInstance, biz: Biz, env: Env) {
  const auth = { preHandler: userGuard(biz) }
  const limit = { ...auth, config: { rateLimit: { max: env.AUTH_RATE_MAX, timeWindow: '1 minute' } } }

  app.get('/api/me', auth, async (req) => biz.user.toDto(me(req)))

  app.patch('/api/me', auth, async (req) => {
    const body = z.object({ nickname }).parse(req.body)
    return biz.user.toDto(await biz.user.rename(me(req).id, body.nickname))
  })

  app.delete('/api/me', auth, async (req, reply) => {
    await biz.user.deleteAccount(me(req).id)
    return reply.code(204).send()
  })

  // 绑定手机号：可以用短信验证码（{phone, code}）或一键登录（{token}）
  app.post('/api/me/bind/:provider', limit, async (req) => {
    const { provider } = z.object({ provider: z.enum(['wechat', 'phone', 'apple']) }).parse(req.params)
    const body = req.body as Record<string, unknown> | undefined
    const cred =
      provider === 'phone'
        ? body && 'token' in body
          ? credentialParsers.onekey(body)
          : credentialParsers.sms(body)
        : credentialParsers[provider](body)
    return biz.user.toDto(await biz.auth.bind(me(req).id, cred))
  })

  app.delete('/api/me/bind/:provider', auth, async (req) => {
    const { provider } = z.object({ provider: z.enum(['wechat', 'phone', 'apple']) }).parse(req.params)
    return biz.user.toDto(await biz.auth.unbind(me(req).id, provider))
  })
}
