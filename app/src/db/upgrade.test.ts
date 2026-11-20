// 升级路径：装着第一版的老用户，账里有数据，一路升级到最新版，账都还在、新列有默认值
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/sql-js'
import { migrate } from 'drizzle-orm/sql-js/migrator'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import * as schema from './schema'

const FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))

/** 只含第一版迁移的迁移目录 */
function firstVersionFolder() {
  const journal = JSON.parse(readFileSync(join(FOLDER, 'meta/_journal.json'), 'utf8'))
  const dir = mkdtempSync(join(tmpdir(), 'zf-v0-'))
  mkdirSync(join(dir, 'meta'))
  const first = journal.entries[0]
  writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: [first] }))
  copyFileSync(join(FOLDER, `${first.tag}.sql`), join(dir, `${first.tag}.sql`))
  return dir
}

describe('从第一版升级到最新版', () => {
  it('老数据都在，新加的列取默认值', async () => {
    const SQL = await initSqlJs()
    const raw = new SQL.Database()
    const db = drizzle(raw, { schema })
    migrate(db, { migrationsFolder: firstVersionFolder() })

    raw.run(`insert into ledgers (id, name, type, created_at, updated_at) values ('L', '我的账本', 'personal', 1, 1)`)
    raw.run(`insert into wallets (id, ledger_id, updated_at, name, kind) values ('W', 'L', 1, '现金', 'cash')`)
    raw.run(`insert into categories (id, ledger_id, updated_at, name, type, icon) values ('C', 'L', 1, '吃饭', 'expense', 'bowl-chopsticks')`)
    raw.run(
      `insert into transactions (id, ledger_id, updated_at, type, amount_cents, category_id, wallet_id, date, note, created_at)
       values ('T', 'L', 1, 'expense', 1250, 'C', 'W', '2026-01-02', '早饭', 1)`,
    )

    migrate(db, { migrationsFolder: FOLDER })

    const t = db.select().from(schema.transactions).all()
    expect(t).toHaveLength(1)
    expect(t[0]).toMatchObject({ id: 'T', amountCents: 1250, note: '早饭', tags: '[]', recurringId: null, photo: null })
    expect(db.select().from(schema.wallets).all()[0]).toMatchObject({ id: 'W', name: '现金' })
    expect(db.select().from(schema.categories).all()[0]).toMatchObject({ id: 'C', name: '吃饭' })
    expect(db.select().from(schema.recurrings).all()).toEqual([])
  })
})
