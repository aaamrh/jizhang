import { count, desc, eq, ilike, like, or, sql } from 'drizzle-orm'
import type { DB } from './index.js'
import { users } from './schema.js'
import { cnDay, cnToday } from './sql.js'

export type IdentityKey = 'phone' | 'wechatId' | 'appleId'

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export const userModel = (db: DB) => ({
  async findById(id: string) {
    return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0]
  },

  async findByIdentity(key: IdentityKey, value: string) {
    return (await db.select().from(users).where(eq(users[key], value)).limit(1))[0]
  },

  /** 并发首次登录撞唯一键时返回 undefined，由调用方重新查询 */
  async create(v: { nickname: string } & Partial<Record<IdentityKey, string>>) {
    return (await db.insert(users).values(v).onConflictDoNothing().returning())[0]
  },

  async touchLogin(id: string) {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id))
  },

  async update(id: string, patch: Partial<{ nickname: string; frozenAt: Date | null } & Record<IdentityKey, string | null>>) {
    return (await db.update(users).set(patch).where(eq(users.id, id)).returning())[0]
  },

  async list(opts: { q: string; limit: number; offset: number }) {
    const q = opts.q.trim()
    const where = q
      ? or(like(users.phone, `%${escapeLike(q)}%`), ilike(users.nickname, `%${escapeLike(q)}%`))
      : undefined
    const items = await db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(opts.limit)
      .offset(opts.offset)
    const [{ total = 0 } = {}] = await db.select({ total: count() }).from(users).where(where)
    return { items, total }
  },

  async counts() {
    const [r] = await db
      .select({
        total: count(),
        vip: sql<number>`(count(*) filter (where ${users.vipUntil} > now()))::int`,
      })
      .from(users)
    return r ?? { total: 0, vip: 0 }
  },

  async newPerDay() {
    const day = cnDay(users.createdAt)
    return db
      .select({ day, n: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`(${users.createdAt} at time zone 'Asia/Shanghai')::date >= ${cnToday} - 29`)
      .groupBy(day)
  },

  /** 在"现有到期时间和现在中较晚的一个"上加 days 天 */
  async extendVip(id: string, days: number) {
    const rows = await db
      .update(users)
      .set({ vipUntil: sql`greatest(coalesce(${users.vipUntil}, now()), now()) + make_interval(days => ${days}::int)` })
      .where(eq(users.id, id))
      .returning({ vipUntil: users.vipUntil })
    return rows[0]
  },

  /** 退款扣回天数，最多扣到现在 */
  async shortenVip(id: string, days: number) {
    await db
      .update(users)
      .set({
        vipUntil: sql`case when ${users.vipUntil} is null then null
          else greatest(now(), ${users.vipUntil} - make_interval(days => ${days}::int)) end`,
      })
      .where(eq(users.id, id))
  },

  async revokeVip(id: string) {
    return (await db.update(users).set({ vipUntil: null }).where(eq(users.id, id)).returning({ id: users.id })).length > 0
  },

  async remove(id: string) {
    await db.delete(users).where(eq(users.id, id))
  },
})
