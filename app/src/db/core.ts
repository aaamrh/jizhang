import { and, eq, isNull, type SQLWrapper } from 'drizzle-orm'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import type * as schema from './schema'

/** 手机上是 expo-sqlite，测试里是 sql.js；两者都是同步的 SQLite 数据库，repo 代码共用 */
export type DB = BaseSQLiteDatabase<'sync', any, typeof schema>

// 手机上由 client.ts 换成 expo-crypto；Node 测试里用自带的 crypto
let gen: () => string = () => (globalThis as any).crypto.randomUUID()
export const setIdGenerator = (fn: () => string) => {
  gen = fn
}
export const newId = () => gen()
export const now = () => Date.now()

/** 每次写入同步表都要带上：更新时间 + 待上传标记 */
export const touched = () => ({ updatedAt: now(), dirty: true })
/** 软删除 */
export const removed = () => ({ deletedAt: now(), updatedAt: now(), dirty: true })
/** 撤销软删除（删完 5 秒内点“撤销”） */
export const restored = () => ({ deletedAt: null, updatedAt: now(), dirty: true })

/** 业务规则不允许的操作，message 直接给用户看 */
export class DomainError extends Error {}

type SyncTable = { deletedAt: SQLWrapper; ledgerId: SQLWrapper }

/** 未被删除的行 */
export const alive = (t: { deletedAt: SQLWrapper }) => isNull(t.deletedAt as any)
/** 属于某账本且未被删除的行 */
export const inLedger = (t: SyncTable, ledgerId: string) => and(isNull(t.deletedAt as any), eq(t.ledgerId as any, ledgerId))
