import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import type { DB } from './index.js'
import { syncRecords, type SyncRow } from './schema.js'

export const syncModel = (db: DB) => ({
  async findMany(entity: string, ids: string[]) {
    if (!ids.length) return []
    return db.select().from(syncRecords).where(and(eq(syncRecords.entity, entity), inArray(syncRecords.id, ids)))
  },

  /** 写入；只覆盖比自己旧的记录（双保险，调用方已比较过） */
  async upsert(rows: SyncRow[]) {
    if (!rows.length) return
    await db
      .insert(syncRecords)
      .values(rows)
      .onConflictDoUpdate({
        target: [syncRecords.entity, syncRecords.id],
        set: {
          data: sql`excluded.data`,
          updatedAt: sql`excluded.updated_at`,
          deletedAt: sql`excluded.deleted_at`,
          version: sql`excluded.version`,
          updatedBy: sql`excluded.updated_by`,
        },
        setWhere: sql`${syncRecords.updatedAt} <= excluded.updated_at and ${syncRecords.ledgerId} = excluded.ledger_id`,
      })
  },

  /** 若干账本里、日期（data.date）在 [start, end) 内、指定类型的未删除账目 */
  async transactionsBetween(ledgerIds: string[], types: readonly string[], start: string, end: string) {
    if (!ledgerIds.length || !types.length) return []
    return db
      .select()
      .from(syncRecords)
      .where(
        and(
          eq(syncRecords.entity, 'transactions'),
          inArray(syncRecords.ledgerId, ledgerIds),
          isNull(syncRecords.deletedAt),
          inArray(sql`${syncRecords.data}->>'type'`, [...types]),
          sql`${syncRecords.data}->>'date' >= ${start}`,
          sql`${syncRecords.data}->>'date' < ${end}`,
        ),
      )
  },

  async since(ledgerId: string, cursor: number, limit: number) {
    return db
      .select()
      .from(syncRecords)
      .where(and(eq(syncRecords.ledgerId, ledgerId), gt(syncRecords.version, cursor)))
      .orderBy(asc(syncRecords.version))
      .limit(limit)
  },
})
