import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Credential } from '../biz/auth.biz.js'
import type { Biz } from '../biz/index.js'
import type { Env } from '../config/env.js'
import type { User } from '../models/schema.js'
import { PHONE_RE } from '../utils/phone.js'

const phone = z.string().regex(PHONE_RE)

/** 各登录方式的请求体 → Credential；绑定接口复用 */
export const credentialParsers = {
  wechat: (b: unknown): Credential => ({ provider: 'wechat', ...z.object({ code: z.string().min(1).max(256) }).parse(b) }),
  sms: (b: unknown): Credential => ({ provider: 'sms', ...z.object({ phone, code: z.string().regex(/^\d{6}$/) }).parse(b) }),
  onekey: (b: unknown): Credential => ({ provider: 'onekey', ...z.object({ token: z.string().min(1).max(4096) }).parse(b) }),
  apple: (b: unknown): Credential => ({
    provider: 'apple',
    ...z.object({ identityToken: z.string().min(1).max(8192), nickname: z.string().max(20).optional() }).parse(b),
  }),
}

export function registerAuthController(app: FastifyInstance, biz: Biz, env: Env) {
  const session = ({ user, isNew }: { user: User; isNew: boolean }) => ({
    token: app.jwt.sign({ role: 'user', sub: user.id }, { expiresIn: '90d' }),
    user: biz.user.toDto(user),
    isNew,
  })
  const limit = { config: { rateLimit: { max: env.AUTH_RATE_MAX, timeWindow: '1 minute' } } }

  app.post(
    '/api/auth/sms/send',
    { config: { rateLimit: { max: env.SMS_SEND_PER_HOUR, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const code = await biz.auth.sendSmsCode(z.object({ phone }).parse(req.body).phone)
      // 测试环境：没接短信服务也能登录，验证码直接回给 App。正式环境（SMS_DEV_ECHO=false）只回 204
      if (env.smsDevEcho) return reply.code(200).send({ devCode: code })
      return reply.code(204).send()
    },
  )

  app.post('/api/auth/sms/login', limit, async (req) => session(await biz.auth.login(credentialParsers.sms(req.body))))
  app.post('/api/auth/wechat', limit, async (req) => session(await biz.auth.login(credentialParsers.wechat(req.body))))
  app.post('/api/auth/onekey', limit, async (req) => session(await biz.auth.login(credentialParsers.onekey(req.body))))
  app.post('/api/auth/apple', limit, async (req) => session(await biz.auth.login(credentialParsers.apple(req.body))))
}
