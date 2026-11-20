// 手机上的数据库实例（只在 App 里用，测试用 sql.js 另建）
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { migrate } from 'drizzle-orm/expo-sqlite/migrator'
import { Directory, File, Paths } from 'expo-file-system'
import { useEffect, useState } from 'react'
import * as Crypto from 'expo-crypto'
import { addDatabaseChangeListener, openDatabaseSync } from 'expo-sqlite'
import migrations from '../../drizzle/migrations'
import { setIdGenerator } from './core'
import * as schema from './schema'

setIdGenerator(() => Crypto.randomUUID())

// enableChangeListener：任何写入都会通知 subscribeDb 的订阅者，界面据此自动刷新
const sqlite = openDatabaseSync('zhangfang.db', { enableChangeListener: true })
export const db = drizzle(sqlite, { schema })

const KEEP_BACKUPS = 2

/** 升级前的备份放在 App 自己的文档目录里（db-backups/），只留最近 2 份 */
function backupBeforeUpgrade(done: number, total: number) {
  const dir = new Directory(Paths.document, 'db-backups')
  if (!dir.exists) dir.create({ intermediates: true })
  const target = new File(dir, `${Date.now()}-v${done}-to-v${total}.db`)
  // VACUUM INTO 得到的是一份完整、一致的数据库文件（直接复制文件可能漏掉还没写回的日志）
  sqlite.execSync(`VACUUM INTO '${decodeURI(target.uri.replace(/^file:\/\//, '')).replace(/'/g, "''")}'`)
  const old = dir
    .list()
    .filter((f): f is File => f instanceof File && f.name.endsWith('.db'))
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(KEEP_BACKUPS)
  for (const f of old) f.delete()
}

function migratedCount() {
  try {
    return sqlite.getFirstSync<{ n: number }>('select count(*) as n from __drizzle_migrations')?.n ?? 0
  } catch {
    return 0 // 新装的 App：还没有迁移记录表
  }
}

/**
 * 建表 / 升级。有没跑过的升级时先备份一份；升级本身在一个事务里，出错整体回滚，账停在升级前的样子。
 * 备份失败（比如手机空间不够）就不升级，免得冒险
 */
export function useDbMigrations() {
  const [state, setState] = useState<{ success: boolean; error?: Error }>({ success: false })
  useEffect(() => {
    void (async () => {
      try {
        const done = migratedCount()
        const total = migrations.journal.entries.length
        if (done > 0 && done < total) backupBeforeUpgrade(done, total)
        await migrate(db, migrations)
        setState({ success: true })
      } catch (e) {
        setState({ success: false, error: e instanceof Error ? e : new Error(String(e)) })
      }
    })()
  }, [])
  return state
}

export function subscribeDb(onChange: () => void) {
  const sub = addDatabaseChangeListener(onChange)
  return () => sub.remove()
}
