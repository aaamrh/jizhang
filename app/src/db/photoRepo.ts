import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import type { DB } from './core'
import { touched } from './core'
import { assets, goals, ledgers, transactions } from './schema'

// 家当、圆梦、账目小票照片的上传队列和下载缓存：几张表的照片列一样，统一处理
const TABLES = { assets, goals, transactions } as const
export type PhotoTable = keyof typeof TABLES

export interface PendingPhoto {
  table: PhotoTable
  id: string
  ledgerId: string
  photo: string
}

/** 等上传的照片：本机有、云端还没有，且账本已经在云端（本地账本登录合并后才会变成云端账本） */
export function pendingUploads(db: DB): PendingPhoto[] {
  const out: PendingPhoto[] = []
  for (const [name, t] of Object.entries(TABLES) as [PhotoTable, (typeof TABLES)[PhotoTable]][]) {
    const rows = db
      .select({ id: t.id, ledgerId: t.ledgerId, photo: t.photo })
      .from(t)
      .innerJoin(ledgers, eq(ledgers.id, t.ledgerId))
      .where(and(isNotNull(t.photo), isNull(t.photoFileId), isNull(t.photoCachedFor), isNull(t.deletedAt), eq(ledgers.remote, true)))
      .all()
    for (const r of rows) out.push({ table: name, id: r.id, ledgerId: r.ledgerId, photo: r.photo! })
  }
  return out
}

/** 上传成功：记下云端 id（要同步给别的手机，所以 dirty）。上传期间照片又换了就不记，下一轮再传新的 */
export function markUploaded(db: DB, table: PhotoTable, id: string, photo: string, fileId: string) {
  const t = TABLES[table]
  db.update(t)
    .set({ photoFileId: fileId, photoCachedFor: fileId, ...touched() })
    .where(and(eq(t.id, id), eq(t.photo, photo), isNull(t.photoFileId)))
    .run()
}

/** 下载完成：记下本机缓存（只在本机，不 dirty）。下载期间云端照片又换了就不记 */
export function setCached(db: DB, table: PhotoTable, id: string, fileId: string, path: string) {
  const t = TABLES[table]
  db.update(t).set({ photo: path, photoCachedFor: fileId }).where(and(eq(t.id, id), eq(t.photoFileId, fileId))).run()
}
