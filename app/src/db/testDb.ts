// 测试专用：在 Node 里用 sql.js 建一个内存 SQLite，跑和手机上同一套迁移与 repo
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/sql-js'
import { migrate } from 'drizzle-orm/sql-js/migrator'
import initSqlJs from 'sql.js'
import type { DB } from './core'
import { ensurePersonalLedger } from './ledgerRepo'
import * as schema from './schema'

export async function makeTestDb(): Promise<{ db: DB; ledgerId: string }> {
  const SQL = await initSqlJs()
  const db = drizzle(new SQL.Database(), { schema })
  migrate(db, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) })
  return { db, ledgerId: ensurePersonalLedger(db) }
}
