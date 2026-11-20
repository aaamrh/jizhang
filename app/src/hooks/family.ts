// 家庭账本和多账本：调接口后同步，成员、账本信息以服务器为准
import * as ledgerApi from '../api/ledgerApi'
import { db } from '../db/client'
import { newId } from '../db/core'
import { purgeLedger, upsertRemoteLedger } from '../db/sync'
import { useSettings } from '../store/settingsStore'
import { attemptApi } from './account'
import { fixCurrentLedger, syncNow } from './sync'

/** 操作成功后同步一次，让成员列表等立刻更新 */
const thenSync = <T>(fn: () => Promise<T>) =>
  attemptApi(async () => {
    const r = await fn()
    await syncNow()
    return r ?? true
  })

/** 解散或退出的正是首页在看的家庭账本：回到我的账本（在看别的家庭就不动） */
const stopViewing = (id: string) => {
  const s = useSettings.getState()
  if (s.familyView === id || s.familyView === '1') s.setFamilyView('')
}

export const familyActions = {
  /**
   * 新建家庭账本（需要会员，否则服务器返回 vip_required；可以建好几个）。shareFrom：自己的账从哪天起汇进去。
   * 家庭账本不记账，是一家人账的汇总，所以本机不写默认钱袋、分类；建好后首页看它
   */
  create: (name: string, cover: string | null, shareFrom: string) =>
    attemptApi(async () => {
      const id = newId()
      const remote = await ledgerApi.createLedger({ id, name: name.trim(), type: 'family', cover, shareFrom })
      upsertRemoteLedger(db, remote)
      useSettings.getState().setFamilyView(id)
      void syncNow()
      return id
    }),

  rename: (id: string, name: string) => thenSync(() => ledgerApi.updateLedger(id, { name: name.trim() })),
  /** 换封面（null = 恢复默认） */
  setCover: (id: string, cover: string | null) => thenSync(() => ledgerApi.updateLedger(id, { cover })),

  /** 解散或退出后，本机马上删掉这个账本 */
  dissolve: (id: string) =>
    attemptApi(async () => {
      await ledgerApi.dissolveLedger(id)
      purgeLedger(db, id)
      fixCurrentLedger()
      stopViewing(id)
      return true
    }),
  leave: (id: string) =>
    attemptApi(async () => {
      await ledgerApi.leaveLedger(id)
      purgeLedger(db, id)
      fixCurrentLedger()
      stopViewing(id)
      return true
    }),

  updateMember: (id: string, memberId: string, patch: { nickname?: string; elderMode?: boolean }) =>
    thenSync(() => ledgerApi.updateMember(id, memberId, patch)),
  removeMember: (id: string, memberId: string) => thenSync(() => ledgerApi.removeMember(id, memberId)),

  createInvite: (id: string) => attemptApi(() => ledgerApi.createInvite(id)),
  listInvites: (id: string) => ledgerApi.listInvites(id),
  revokeInvite: (id: string, code: string) => attemptApi(() => ledgerApi.revokeInvite(id, code).then(() => true)),

  preview: (code: string) => ledgerApi.previewInvite(code.trim().toUpperCase()),
  /** 加入后首页看这个家庭账本，并同步。shareFrom：自己的账从哪天起汇进去 */
  join: (code: string, shareFrom: string) =>
    attemptApi(async () => {
      const l = await ledgerApi.acceptInvite(code.trim().toUpperCase(), shareFrom)
      upsertRemoteLedger(db, l)
      useSettings.getState().setFamilyView(l.id)
      await syncNow()
      return l
    }),
}
