import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { createBiz } from './biz/index.js'
import type { Env } from './config/env.js'
import { registerAdminController } from './controllers/admin.controller.js'
import { registerAppController } from './controllers/app.controller.js'
import { registerAuthController } from './controllers/auth.controller.js'
import { registerFileController } from './controllers/file.controller.js'
import { registerLedgerController } from './controllers/ledger.controller.js'
import { registerLegalController } from './controllers/legal.controller.js'
import { registerMeController } from './controllers/me.controller.js'
import { registerSyncController } from './controllers/sync.controller.js'
import { registerVipController } from './controllers/vip.controller.js'
import type { AppleVerifier } from './integrations/apple.js'
import type { OnekeyClient } from './integrations/onekey.js'
import type { SmsSender } from './integrations/sms.js'
import type { Storage } from './integrations/storage.js'
import type { WechatClient } from './integrations/wechat.js'
import { createModels, type DB } from './models/index.js'
import { errorHandler } from './plugins/errors.js'

export interface AppDeps {
  db: DB
  env: Env
  sms: SmsSender
  wechat: WechatClient | null
  onekey: OnekeyClient | null
  apple: AppleVerifier | null
  storage: Storage
  logger?: boolean
}

/** 组装顺序：models（数据）→ biz（业务）→ controllers（HTTP） */
export async function buildApp({ db, env, sms, wechat, onekey, apple, storage, logger = false }: AppDeps) {
  const app = Fastify({ logger, trustProxy: env.TRUST_PROXY })
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' })
  await app.register(jwt, { secret: env.JWT_SECRET })
  app.setErrorHandler(errorHandler)

  const models = createModels(db)
  await models.vip.seedProducts()
  const biz = createBiz(models, {
    sms,
    wechat,
    onekey,
    apple,
    secret: env.JWT_SECRET,
    logger: app.log,
    adminPassword: env.ADMIN_PASSWORD,
    publicUrl: env.PUBLIC_URL.replace(/\/$/, ''),
    mockPay: env.mockPay,
    storage,
  })

  app.get('/healthz', async () => ({ ok: true }))
  registerAppController(app, biz)
  registerAuthController(app, biz, env)
  registerMeController(app, biz, env)
  registerLedgerController(app, biz)
  registerSyncController(app, biz)
  await registerFileController(app, biz)
  registerVipController(app, biz)
  registerAdminController(app, biz, env)
  registerLegalController(app)
  return app
}
