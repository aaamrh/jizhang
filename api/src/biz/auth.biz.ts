import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { AppleVerifier } from '../integrations/apple.js'
import type { OnekeyClient } from '../integrations/onekey.js'
import type { SmsSender } from '../integrations/sms.js'
import type { WechatClient } from '../integrations/wechat.js'
import type { Models } from '../models/index.js'
import type { IdentityKey } from '../models/user.model.js'
import { AppError } from '../utils/errors.js'
import { defaultNickname } from '../utils/random.js'
import { FROZEN_MESSAGE, providersOf, type Provider } from './user.biz.js'

const CODE_TTL_MS = 5 * 60_000
const RESEND_MS = 60_000
const MAX_ATTEMPTS = 5

export interface AuthDeps {
  sms: SmsSender
  wechat: WechatClient | null
  onekey: OnekeyClient | null
  apple: AppleVerifier | null
  secret: string
  logger: { error: (obj: unknown, msg?: string) => void }
}

/** 各登录方式的请求体（与 docs/api.md 一致） */
export type Credential =
  | { provider: 'wechat'; code: string }
  | { provider: 'sms'; phone: string; code: string }
  | { provider: 'onekey'; token: string }
  | { provider: 'apple'; identityToken: string; nickname?: string }

const notConfigured = (what: string) => new AppError(501, 'not_configured', `${what}暂未开通`)
const KEY_OF: Record<Provider, IdentityKey> = { phone: 'phone', wechat: 'wechatId', apple: 'appleId' }

export function createAuthBiz(models: Models, { sms, wechat, onekey, apple, secret, logger }: AuthDeps) {
  const hash = (phone: string, code: string) => createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex')

  /** 外部调用失败统一记日志并转成用户能看懂的错误 */
  async function external<T>(what: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (e) {
      logger.error(e, `${what} failed`)
      throw new AppError(401, 'auth_failed', `${what}失败，请重试`)
    }
  }

  async function verifySmsCode(phone: string, code: string) {
    const invalid = new AppError(401, 'sms_invalid', '验证码不对或已过期')
    const rec = await models.smsCodes.get(phone)
    if (!rec || rec.expiresAt < new Date()) throw invalid
    const attempts = await models.smsCodes.bumpAttempts(phone)
    if (attempts === undefined) throw invalid
    if (attempts > MAX_ATTEMPTS) throw new AppError(429, 'sms_locked', '错误次数过多，请重新获取验证码')
    if (!timingSafeEqual(Buffer.from(rec.codeHash), Buffer.from(hash(phone, code)))) throw invalid
    await models.smsCodes.remove(phone)
  }

  /** 把一种登录凭证解析成账号上的某一列和值 */
  async function resolve(c: Credential): Promise<{ key: IdentityKey; value: string }> {
    switch (c.provider) {
      case 'sms':
        await verifySmsCode(c.phone, c.code)
        return { key: 'phone', value: c.phone }
      case 'onekey': {
        if (!onekey) throw notConfigured('本机号码一键登录')
        const client = onekey
        return { key: 'phone', value: await external('一键登录', () => client.getPhone(c.token)) }
      }
      case 'wechat': {
        if (!wechat) throw notConfigured('微信登录')
        const client = wechat
        const r = await external('微信登录', () => client.exchange(c.code))
        return { key: 'wechatId', value: r.unionid ?? r.openid }
      }
      case 'apple': {
        if (!apple) throw notConfigured('Apple 登录')
        const verifier = apple
        return { key: 'appleId', value: await external('Apple 登录', () => verifier.verify(c.identityToken)) }
      }
    }
  }

  return {
    /** 发验证码；返回验证码本身（只有测试环境的 controller 会把它回给 App） */
    async sendSmsCode(phone: string) {
      const prev = await models.smsCodes.get(phone)
      if (prev && Date.now() - prev.sentAt.getTime() < RESEND_MS) {
        throw new AppError(429, 'sms_too_soon', '验证码发送太频繁，请稍后再试')
      }
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
      await models.smsCodes.upsert(phone, hash(phone, code), new Date(Date.now() + CODE_TTL_MS))
      try {
        await sms.send(phone, code)
      } catch (e) {
        logger.error(e, 'sms send failed')
        await models.smsCodes.remove(phone) // 没发出去就不占用冷却时间
        throw new AppError(502, 'sms_failed', '短信发送失败，请稍后再试')
      }
      return code
    },

    /** 登录；该登录方式没有对应账号时自动注册 */
    async login(c: Credential) {
      const { key, value } = await resolve(c)
      let user = await models.users.findByIdentity(key, value)
      let isNew = false
      if (!user) {
        const nickname = (c.provider === 'apple' && c.nickname?.trim()) || defaultNickname()
        user = await models.users.create({ nickname, [key]: value })
        isNew = !!user
        user ??= await models.users.findByIdentity(key, value) // 并发首次登录，对方已建号
      }
      if (!user) throw new AppError(500, 'internal', '登录失败，请重试')
      if (user.frozenAt) throw new AppError(401, 'unauthorized', FROZEN_MESSAGE)
      await models.users.touchLogin(user.id)
      return { user, isNew }
    },

    async bind(userId: string, c: Credential) {
      const { key, value } = await resolve(c)
      const owner = await models.users.findByIdentity(key, value)
      if (owner && owner.id !== userId) throw new AppError(409, 'already_bound', '已被其他账号绑定')
      return (await models.users.update(userId, { [key]: value }))!
    },

    async unbind(userId: string, provider: Provider) {
      const user = (await models.users.findById(userId))!
      const bound = providersOf(user)
      if (!bound.includes(provider)) return user
      if (bound.length <= 1) throw new AppError(400, 'last_provider', '至少要保留一种登录方式')
      return (await models.users.update(userId, { [KEY_OF[provider]]: null }))!
    },
  }
}
