import { randomUUID } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { buildApp, type AppDeps } from '../src/app.js'
import { loadEnv } from '../src/config/env.js'
import { LocalDiskStorage } from '../src/integrations/storage.js'
import * as schema from '../src/models/schema.js'

export const ADMIN_PASSWORD = 'admin-pass-123'
export const uuid = () => randomUUID()

type Fakes = Partial<Pick<AppDeps, 'wechat' | 'onekey' | 'apple'>>

/** 用内存里的真 Postgres（PGlite）跑完整的 controller → biz → model */
export async function makeApp(fakes: Fakes = {}, envOverrides: Record<string, string> = {}) {
  const pg = new PGlite()
  const db = drizzle(pg, { schema })
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  const env = loadEnv({
    DATABASE_URL: 'unused',
    JWT_SECRET: 'x'.repeat(32),
    ADMIN_PASSWORD,
    PUBLIC_URL: 'https://zf.example.com',
    AUTH_RATE_MAX: '10000',
    SMS_SEND_PER_HOUR: '10000',
    ADMIN_LOGIN_PER_MIN: '10000',
    ...envOverrides,
  })
  const sent: { phone: string; code: string }[] = []
  const storageDir = mkdtempSync(join(tmpdir(), 'zf-files-'))
  const app = await buildApp({
    db,
    env,
    sms: { send: async (phone, code) => void sent.push({ phone, code }) },
    wechat: fakes.wechat ?? null,
    onekey: fakes.onekey ?? null,
    apple: fakes.apple ?? null,
    storage: new LocalDiskStorage(storageDir),
  })

  type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  const call = async (method: Method, url: string, body?: unknown, token?: string) => {
    const res = await app.inject({
      method,
      url,
      payload: body as object | undefined,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
    const isJson = res.headers['content-type']?.toString().includes('json')
    return { status: res.statusCode, body: isJson && res.body ? (res.json() as any) : res.body }
  }

  let phoneSeq = 0
  /** 新手机号注册并登录，返回 { token, user } */
  const newUser = async (phone = `139${String(10_000_000 + ++phoneSeq).slice(-8)}`) => {
    await call('POST', '/api/auth/sms/send', { phone })
    const code = sent.filter((s) => s.phone === phone).at(-1)!.code
    const r = await call('POST', '/api/auth/sms/login', { phone, code })
    if (r.status !== 200) throw new Error(`login failed ${r.status} ${JSON.stringify(r.body)}`)
    return r.body as { token: string; user: { id: string; nickname: string; isVip: boolean } }
  }

  const adminToken = async () => (await call('POST', '/admin/api/login', { password: ADMIN_PASSWORD })).body.token as string

  const grantVip = async (userId: string, days = 30) =>
    call('POST', `/admin/api/users/${userId}/vip`, { days }, await adminToken())

  /** multipart 上传：先 ledgerId 字段，再文件 */
  const upload = async (token: string, ledgerId: string, bytes: Buffer, filename = 'p.jpg') => {
    const boundary = '----zf' + randomUUID()
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="ledgerId"\r\n\r\n${ledgerId}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/api/files',
      payload: body,
      headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/form-data; boundary=${boundary}` },
    })
    return { status: res.statusCode, body: res.json() as any }
  }

  return { app, pg, sent, call, upload, storageDir, newUser, adminToken, grantVip, close: async () => { await app.close(); await pg.close() } }
}

export type TestApp = Awaited<ReturnType<typeof makeApp>>
