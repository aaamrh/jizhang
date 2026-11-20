import { eq, sql } from 'drizzle-orm'
import type { DB } from './index.js'
import { smsCodes } from './schema.js'

export const smsCodeModel = (db: DB) => ({
  async get(phone: string) {
    return (await db.select().from(smsCodes).where(eq(smsCodes.phone, phone)).limit(1))[0]
  },

  /** 新验证码覆盖旧的，错误次数清零 */
  async upsert(phone: string, codeHash: string, expiresAt: Date) {
    const v = { codeHash, expiresAt, attempts: 0, sentAt: new Date() }
    await db.insert(smsCodes).values({ phone, ...v }).onConflictDoUpdate({ target: smsCodes.phone, set: v })
  },

  /** 原子 +1 并返回新次数；先加再比对，并发猜码也不会超过上限 */
  async bumpAttempts(phone: string) {
    const rows = await db
      .update(smsCodes)
      .set({ attempts: sql`${smsCodes.attempts} + 1` })
      .where(eq(smsCodes.phone, phone))
      .returning({ attempts: smsCodes.attempts })
    return rows[0]?.attempts
  },

  async remove(phone: string) {
    await db.delete(smsCodes).where(eq(smsCodes.phone, phone))
  },
})
