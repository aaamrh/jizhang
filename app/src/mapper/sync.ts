import type { SyncRecord } from '../types/api'

/** 同步表的公共列；其余所有列都放进 data，服务器不解析 */
type SyncRow = { id: string; ledgerId: string; updatedAt: number; deletedAt: number | null; dirty: boolean } & Record<string, unknown>

/** 只存在本机、不上传的列：照片的本机缓存路径和它对应的云端 id（云端 id 本身 photoFileId 是同步的） */
export const LOCAL_ONLY = ['photo', 'photoCachedFor'] as const

export function toSyncRecord({ id, ledgerId, updatedAt, deletedAt, dirty: _, ...rest }: SyncRow): SyncRecord {
  const data = { ...rest }
  for (const k of LOCAL_ONLY) delete data[k]
  return { id, ledgerId, updatedAt, deletedAt, data }
}

/**
 * 服务器记录 → 本地行。只取本地表里存在的列（别的版本多出来的字段忽略），
 * 收到的就是最新的，dirty = false。缺少必填列时由数据库报错，调用方跳过这一条。
 */
export function fromSyncRecord(r: SyncRecord, columns: string[]): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const c of columns) if (c in r.data && !(LOCAL_ONLY as readonly string[]).includes(c)) row[c] = r.data[c]
  return { ...row, id: r.id, ledgerId: r.ledgerId, updatedAt: r.updatedAt, deletedAt: r.deletedAt, dirty: false }
}
