import type { Models } from '../models/index.js'
import type { User } from '../models/schema.js'
import { AppError } from '../utils/errors.js'
import { maskPhone } from '../utils/phone.js'

export type Provider = 'wechat' | 'phone' | 'apple'

export const isVip = (u: Pick<User, 'vipUntil'>) => !!u.vipUntil && u.vipUntil > new Date()

export const providersOf = (u: User): Provider[] => [
  ...(u.wechatId ? (['wechat'] as const) : []),
  ...(u.phone ? (['phone'] as const) : []),
  ...(u.appleId ? (['apple'] as const) : []),
]

export const FROZEN_MESSAGE = '账号已冻结，如有疑问请联系客服'

export function createUserBiz(models: Models, purgeFiles: (ledgerIds: string[]) => Promise<void> = async () => {}) {
  return {
    /** 给 App 的用户信息：手机号打码 */
    toDto(u: User) {
      return {
        id: u.id,
        nickname: u.nickname,
        phone: u.phone ? maskPhone(u.phone) : null,
        providers: providersOf(u),
        vipUntil: u.vipUntil?.toISOString() ?? null,
        isVip: isVip(u),
        createdAt: u.createdAt.toISOString(),
      }
    },

    /** 每个需要登录的请求都会调用：账号不存在或被冻结 → 401 */
    async getActive(id: string) {
      const u = await models.users.findById(id)
      if (!u) throw new AppError(401, 'unauthorized', '登录已失效，请重新登录')
      if (u.frozenAt) throw new AppError(401, 'unauthorized', FROZEN_MESSAGE)
      return u
    },

    async rename(id: string, nickname: string) {
      return (await models.users.update(id, { nickname }))!
    },

    /** 注销：自己的家庭账本有其他成员时转给加入最早的人，否则连同数据一起删除 */
    async deleteAccount(userId: string) {
      const deleted: string[] = []
      await models.transaction(async (m) => {
        for (const l of await m.ledgers.ownedLive(userId)) {
          const heir = l.type === 'family' ? await m.ledgers.earliestOtherUser(l.id, userId) : undefined
          if (heir?.userId) {
            await m.ledgers.update(l.id, { ownerId: heir.userId })
            await m.ledgers.updateMember(heir.id, { role: 'admin' })
          } else {
            await m.ledgers.hardDelete(l.id) // 成员、邀请、同步数据级联删除
            deleted.push(l.id)
          }
        }
        await m.ledgers.leaveAll(userId)
        await m.users.remove(userId)
      })
      await purgeFiles(deleted)
    },
  }
}
