import { count, sql, desc } from 'drizzle-orm'
import type { DB } from './index.js'
import { clientErrors, deviceDays, devices } from './schema.js'
import { cnDay, cnToday } from './sql.js'

export const deviceModel = (db: DB) => ({
  async insertErrors(rows: (typeof clientErrors.$inferInsert)[]) {
    if (rows.length) await db.insert(clientErrors).values(rows)
  },

  /** 最近的出错，按上报时间从新到旧 */
  recentErrors: (limit: number) => db.select().from(clientErrors).orderBy(desc(clientErrors.createdAt)).limit(limit),

  async upsertPing(v: { id: string; platform: string; appVersion: string; userId: string | null }) {
    await db
      .insert(devices)
      .values(v)
      .onConflictDoUpdate({
        target: devices.id,
        // 没带登录信息的上报不清掉已记录的用户
        set: { platform: v.platform, appVersion: v.appVersion, userId: sql`coalesce(excluded.user_id, ${devices.userId})` },
      })
    await db.insert(deviceDays).values({ deviceId: v.id, day: cnToday }).onConflictDoNothing()
  },

  async summary() {
    const [total] = await db.select({ n: count() }).from(devices)
    const [active] = await db.select({ n: count() }).from(deviceDays).where(sql`${deviceDays.day} = ${cnToday}`)
    const [new7d] = await db
      .select({ n: count() })
      .from(devices)
      .where(sql`(${devices.firstSeen} at time zone 'Asia/Shanghai')::date >= ${cnToday} - 6`)
    const platforms = await db.select({ platform: devices.platform, n: count() }).from(devices).groupBy(devices.platform)
    const versions = await db
      .select({ version: devices.appVersion, n: count() })
      .from(devices)
      .groupBy(devices.appVersion)
      .orderBy(desc(count()))
      .limit(10)
    return {
      total: total?.n ?? 0,
      active: active?.n ?? 0,
      new7d: new7d?.n ?? 0,
      platforms,
      versions,
    }
  },

  /** 最近 30 天：每天活跃设备数 / 新增设备数 */
  async activePerDay() {
    return db
      .select({ day: sql<string>`to_char(${deviceDays.day}, 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(deviceDays)
      .where(sql`${deviceDays.day} >= ${cnToday} - 29`)
      .groupBy(deviceDays.day)
  },

  async newPerDay() {
    const day = cnDay(devices.firstSeen)
    return db
      .select({ day, n: sql<number>`count(*)::int` })
      .from(devices)
      .where(sql`(${devices.firstSeen} at time zone 'Asia/Shanghai')::date >= ${cnToday} - 29`)
      .groupBy(day)
  },
})
