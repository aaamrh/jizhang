import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { buildApp } from './app.js'
import { loadEnv } from './config/env.js'
import { createAppleVerifier } from './integrations/apple.js'
import { ConsoleSms } from './integrations/sms.js'
import { createStorage } from './integrations/storage-factory.js'
import { createWechatClient } from './integrations/wechat.js'
import * as schema from './models/schema.js'

const env = loadEnv()
const client = postgres(env.DATABASE_URL, { max: 10 })
const db = drizzle(client, { schema })

// 启动时自动建表/升级，部署时不用手动跑迁移
await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })

const app = await buildApp({
  db,
  env,
  sms: new ConsoleSms(),
  wechat: createWechatClient(env.WECHAT_APP_ID, env.WECHAT_APP_SECRET),
  onekey: null, // 开通阿里云号码认证后接入，见 integrations/onekey.ts
  apple: createAppleVerifier(env.APPLE_BUNDLE_ID),
  storage: createStorage(env),
  logger: true,
})

app.log.warn('短信为 console 模式：验证码只打印在日志里，不会真正发送')
if (!env.WECHAT_APP_ID) app.log.warn('未配置 WECHAT_APP_ID / WECHAT_APP_SECRET：微信登录不可用')
if (!env.APPLE_BUNDLE_ID) app.log.warn('未配置 APPLE_BUNDLE_ID：Apple 登录不可用')
if (env.smsDevEcho) app.log.warn('测试验证码回显已开启：发验证码接口会把验证码返回给 App，仅限测试环境')
if (env.mockPay) app.log.warn('模拟支付已开启：仅限测试环境，生产环境请设置 NODE_ENV=production')

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close()
    await client.end()
    process.exit(0)
  })
}

await app.listen({ port: env.PORT, host: env.HOST })
