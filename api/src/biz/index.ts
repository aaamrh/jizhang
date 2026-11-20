import type { Storage } from '../integrations/storage.js'
import type { Models } from '../models/index.js'
import { createAdminBiz } from './admin.biz.js'
import { createAuthBiz, type AuthDeps } from './auth.biz.js'
import { createDeviceBiz } from './device.biz.js'
import { createFileBiz } from './file.biz.js'
import { createLedgerBiz } from './ledger.biz.js'
import { createReleaseBiz } from './release.biz.js'
import { createSyncBiz } from './sync.biz.js'
import { createUserBiz } from './user.biz.js'
import { createVipBiz } from './vip.biz.js'

export type BizDeps = AuthDeps & { adminPassword: string; publicUrl: string; mockPay: boolean; storage: Storage }

export function createBiz(models: Models, deps: BizDeps) {
  // 账本被删、账号注销后，清掉对应的照片文件
  const purge = (ledgerIds: string[]) => file.purgeLedgers(ledgerIds)
  const ledger = createLedgerBiz(models, deps.publicUrl, purge)
  const file = createFileBiz(models, deps.storage, ledger.requireMember, deps.logger)
  return {
    auth: createAuthBiz(models, deps),
    user: createUserBiz(models, purge),
    file,
    ledger,
    sync: createSyncBiz(models, ledger.list),
    vip: createVipBiz(models, { mockPay: deps.mockPay }),
    device: createDeviceBiz(models),
    release: createReleaseBiz(models),
    admin: createAdminBiz(models, deps.adminPassword),
  }
}

export type Biz = ReturnType<typeof createBiz>
