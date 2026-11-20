import { createHash, timingSafeEqual } from 'node:crypto'
import type { Models } from '../models/index.js'
import { AppError } from '../utils/errors.js'
import { cnDayString, lastDays } from '../utils/time.js'
import { isVip, providersOf } from './user.biz.js'

const digest = (s: string) => createHash('sha256').update(s).digest()
const notFound = () => new AppError(404, 'not_found', '用户不存在')

export function createAdminBiz(models: Models, adminPassword: string) {
  return {
    checkPassword(password: string) {
      if (!timingSafeEqual(digest(password), digest(adminPassword))) {
        throw new AppError(401, 'bad_credentials', '密码不对')
      }
    },

    async stats() {
      const [dev, activeRows, newDevRows, newUserRows, users, family, revToday, revMonth, paying] = await Promise.all([
        models.devices.summary(),
        models.devices.activePerDay(),
        models.devices.newPerDay(),
        models.users.newPerDay(),
        models.users.counts(),
        models.ledgers.countFamily(),
        models.vip.revenue('today'),
        models.vip.revenue('month'),
        models.vip.payingUsers(),
      ])
      const by = (rows: { day: string; n: number }[]) => new Map(rows.map((r) => [r.day, r.n]))
      const [active, newDev, newUser] = [by(activeRows), by(newDevRows), by(newUserRows)]
      const platform = (name: string) => dev.platforms.find((p) => p.platform === name)?.n ?? 0
      const sum = (rows: { cents: number }[]) => rows.reduce((s, r) => s + r.cents, 0)
      return {
        devices: {
          total: dev.total,
          activeToday: dev.active,
          new7d: dev.new7d,
          ios: platform('ios'),
          android: platform('android'),
          versions: dev.versions.map((v) => ({ version: v.version, count: v.n })),
        },
        users: {
          total: users.total,
          vip: users.vip,
          paying,
          conversion: users.total ? paying / users.total : 0, // 付过费的人 ÷ 注册用户
          familyLedgers: family,
        },
        revenue: {
          todayCents: sum(revToday),
          monthCents: sum(revMonth),
          month: revMonth, // 按方案、渠道
        },
        series: lastDays(cnDayString(), 30).map((day) => ({
          day,
          active: active.get(day) ?? 0,
          newDevices: newDev.get(day) ?? 0,
          newUsers: newUser.get(day) ?? 0,
        })),
      }
    },

    async listUsers(q: { q: string; page: number; pageSize: number }) {
      const { items, total } = await models.users.list({ q: q.q, limit: q.pageSize, offset: (q.page - 1) * q.pageSize })
      return {
        total,
        items: items.map((u) => ({
          id: u.id,
          nickname: u.nickname,
          phone: u.phone, // 后台显示完整手机号，客服查人用
          providers: providersOf(u),
          vipUntil: u.vipUntil?.toISOString() ?? null,
          isVip: isVip(u),
          frozen: !!u.frozenAt,
          createdAt: u.createdAt.toISOString(),
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        })),
      }
    },

    async grantVip(id: string, days: number) {
      const r = await models.users.extendVip(id, days)
      if (!r) throw notFound()
      return { vipUntil: r.vipUntil?.toISOString() ?? null }
    },

    async revokeVip(id: string) {
      if (!(await models.users.revokeVip(id))) throw notFound()
    },

    async setFrozen(id: string, frozen: boolean) {
      if (!(await models.users.update(id, { frozenAt: frozen ? new Date() : null }))) throw notFound()
    },
  }
}
