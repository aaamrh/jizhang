import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { DB } from './index.js'
import { files } from './schema.js'

export const fileModel = (db: DB) => ({
  async insert(v: { ownerUserId: string; ledgerId: string; contentType: string; size: number }) {
    return (await db.insert(files).values(v).returning())[0]!
  },

  async find(id: string) {
    return (await db.select().from(files).where(and(eq(files.id, id), isNull(files.deletedAt))).limit(1))[0]
  },

  async softDelete(id: string) {
    await db.update(files).set({ deletedAt: new Date() }).where(eq(files.id, id))
  },

  async listByLedgers(ledgerIds: string[]) {
    if (!ledgerIds.length) return []
    return db.select().from(files).where(inArray(files.ledgerId, ledgerIds))
  },

  async deleteRows(ids: string[]) {
    if (ids.length) await db.delete(files).where(inArray(files.id, ids))
  },
})
