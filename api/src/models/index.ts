import type { PgDatabase } from 'drizzle-orm/pg-core'
import { deviceModel } from './device.model.js'
import { fileModel } from './file.model.js'
import { ledgerModel } from './ledger.model.js'
import { releaseModel } from './release.model.js'
import type * as schema from './schema.js'
import { smsCodeModel } from './smsCode.model.js'
import { syncModel } from './sync.model.js'
import { userModel } from './user.model.js'
import { vipModel } from './vip.model.js'

/** 生产用 postgres-js，测试用 PGlite，两者都是 PgDatabase */
export type DB = PgDatabase<any, typeof schema>

const tables = (db: DB) => ({
  users: userModel(db),
  smsCodes: smsCodeModel(db),
  ledgers: ledgerModel(db),
  sync: syncModel(db),
  vip: vipModel(db),
  devices: deviceModel(db),
  releases: releaseModel(db),
  files: fileModel(db),
})

export type Models = ReturnType<typeof tables> & {
  /** 在一个数据库事务里执行，fn 拿到的 models 都走这个事务 */
  transaction<T>(fn: (m: Models) => Promise<T>): Promise<T>
}

export function createModels(db: DB): Models {
  return {
    ...tables(db),
    transaction: (fn) => db.transaction((tx) => fn(createModels(tx as unknown as DB))),
  }
}
