import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Biz } from '../biz/index.js'
import { ENTITIES, MAX_PUSH, type SyncRequest } from '../biz/sync.biz.js'
import { me, userGuard } from '../plugins/auth.js'

const record = z.object({
  id: z.uuid(),
  ledgerId: z.uuid(),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.number().int().nonnegative().nullable(),
  data: z.record(z.string(), z.unknown()),
})

const body = z
  .object({
    cursors: z.record(z.string(), z.number().int().nonnegative()).default({}),
    changes: z.partialRecord(z.enum(ENTITIES), z.array(record)).default({}),
  })
  .refine((b) => Object.values(b.changes).reduce((n, list) => n + (list?.length ?? 0), 0) <= MAX_PUSH, {
    message: `每次最多上传 ${MAX_PUSH} 条`,
  })

export function registerSyncController(app: FastifyInstance, biz: Biz) {
  app.post('/api/sync', { preHandler: userGuard(biz), bodyLimit: 16 * 1024 * 1024 }, async (req) =>
    biz.sync.sync(me(req).id, body.parse(req.body) as SyncRequest),
  )
}
