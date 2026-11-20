import { z } from 'zod'

const bool = z.enum(['true', 'false']).transform((v) => v === 'true')
const optional = z
  .string()
  .optional()
  .transform((v) => v || undefined) // .env 里写了 KEY= 但没值，当作没配置

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少 32 位'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD 至少 8 位'),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  // 对外访问地址，用于生成邀请链接
  PUBLIC_URL: z.string().default('http://localhost:3000'),
  // 放在 nginx 等反向代理后面时设为 true，限流才会按真实 IP 计算
  TRUST_PROXY: bool.default(false),
  // 模拟支付：不设置时，非 production 环境自动开启
  ENABLE_MOCK_PAY: bool.optional(),
  // 测试环境把短信验证码直接返回给 App（没接短信服务时也能登录）。不设置时非 production 自动开启；正式环境必须关
  SMS_DEV_ECHO: bool.optional(),
  WECHAT_APP_ID: optional,
  WECHAT_APP_SECRET: optional,
  APPLE_BUNDLE_ID: optional,
  // 照片存储：local = 本机磁盘（开发、单机部署，docker 里挂卷）；s3 = S3 兼容对象存储（阿里云 OSS、腾讯云 COS）
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_DIR: z.string().default('./data/files'),
  S3_ENDPOINT: optional,
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: optional,
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,
  S3_FORCE_PATH_STYLE: bool.default(false),
  AUTH_RATE_MAX: z.coerce.number().int().default(10), // 登录类接口：每 IP 每分钟
  SMS_SEND_PER_HOUR: z.coerce.number().int().default(20), // 发验证码：每 IP 每小时
  ADMIN_LOGIN_PER_MIN: z.coerce.number().int().default(5),
})

export type Env = z.infer<typeof schema> & { mockPay: boolean; smsDevEcho: boolean }

export function loadEnv(src: NodeJS.ProcessEnv = process.env): Env {
  const e = schema.parse(src)
  return {
    ...e,
    mockPay: e.ENABLE_MOCK_PAY ?? e.NODE_ENV !== 'production',
    smsDevEcho: e.SMS_DEV_ECHO ?? e.NODE_ENV !== 'production',
  }
}
