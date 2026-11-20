import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Biz } from '../biz/index.js'
import { optionalUserId } from '../plugins/auth.js'
import { VERSION_RE } from '../utils/version.js'

const pingBody = z.object({
  deviceId: z.uuid(),
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().regex(VERSION_RE),
})

const errorsBody = z.object({
  deviceId: z.uuid(),
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().regex(VERSION_RE),
  reports: z
    .array(
      z.object({
        message: z.string().max(500),
        stack: z.string().max(4000),
        fatal: z.boolean(),
        at: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(20),
})

const versionQuery = z.object({
  platform: z.enum(['ios', 'android']),
  current: z.string().regex(VERSION_RE),
})

/** 匿名上报、检查更新 */
export function registerAppController(app: FastifyInstance, biz: Biz) {
  app.post('/api/devices/ping', async (req, reply) => {
    await biz.device.ping(pingBody.parse(req.body), await optionalUserId(req))
    return reply.code(204).send()
  })

  // 出错上报：一次最多 20 条，每台每分钟 10 次
  app.post('/api/client-errors', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    await biz.device.reportErrors(errorsBody.parse(req.body))
    return reply.code(204).send()
  })

  app.get('/api/app/version', async (req) => {
    const q = versionQuery.parse(req.query)
    return biz.release.checkUpdate(q.platform, q.current)
  })
}
