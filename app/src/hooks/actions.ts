// 页面的写操作都通过这里，自动带上当前账本。业务规则在 db 层，违规时抛 DomainError
import * as assetRepo from '../db/assetRepo'
import * as budgetRepo from '../db/budgetRepo'
import * as categoryRepo from '../db/categoryRepo'
import { db } from '../db/client'
import * as dayRepo from '../db/dayRepo'
import * as goalRepo from '../db/goalRepo'
import * as recurringRepo from '../db/recurringRepo'
import { DomainError } from '../db/core'
import { personalLedger } from '../db/ledgerRepo'
import { getSetting, setSetting } from '../db/settingsRepo'
import * as txnRepo from '../db/txnRepo'
import * as templateRepo from '../db/templateRepo'
import * as tagRepo from '../db/tagRepo'
import * as walletRepo from '../db/walletRepo'
import { currentUserId, useAuth } from '../store/authStore'
import { useSettings } from '../store/settingsStore'
import type { BudgetLine, CategoryType, CostMode, GoalInput, Review, TemplateInput, TxnInput, WalletKind } from '../types/domain'
import { budgetAlertLevel, type AlertLevel } from '../utils/budget'
import { monthOf, today } from '../utils/dates'
import { crossedHalf, goalCopy, shiftMonths } from '../utils/goals'
import type { Repeat } from '../utils/recurring'
import { formatYuan } from '../utils/money'
import { attempt, confirm, showAlert } from '../components/dialogs'
import { forgetPhoto } from './photo'
import { useUi } from '../store/uiStore'

const ledger = () => useSettings.getState().currentLedgerId
// 记账人：登录后为当前用户 id，未登录为 null
const me = currentUserId

export const txnActions = {
  create: (v: TxnInput) => {
    const id = txnRepo.createTxn(db, ledger(), v, me())
    if (v.type === 'transfer') goalActions.afterTransfer(v.walletId, v.toWalletId, v.amountCents) // 往储钱罐存、取
    return id
  },
  update: (id: string, v: TxnInput) => {
    txnRepo.updateTxn(db, id, v)
    if (v.type === 'transfer') goalActions.check()
  },
  remove: (id: string) => txnRepo.deleteTxn(db, id),
  restore: (id: string) => txnRepo.restoreTxn(db, id),
  deleteBlocker: (id: string) => txnRepo.deleteBlocker(db, id),
  review: (id: string, r: Review | null) => txnRepo.setReview(db, id, r),
  reviewList: (month: string) => txnRepo.reviewCandidates(db, ledger(), month),
}

/** 周期记账：只在我的账本里；保存后马上把到日子的补记上 */
export const recurringActions = {
  get: (id: string) => recurringRepo.getRecurring(db, id),
  /** doneThrough：从一笔已有的账设成周期时传那笔的日期（那一笔算记过了） */
  create: (v: recurringRepo.RecurringInput, doneThrough: string | null = null) => {
    const id = recurringRepo.createRecurring(db, ledger(), v, doneThrough)
    recurringActions.runDue()
    return id
  },
  draftFromTxn: (txnId: string) => recurringRepo.draftFromTxn(db, txnId),
  /** 记一笔时选了“重复”：刚记的这笔算这一期的，以后到日子自动记；日期在以前的，补记到今天 */
  startFromTxn: (txnId: string, repeat: Repeat) => {
    const id = recurringRepo.recurringFromTxn(db, ledger(), txnId, repeat)
    if (id) recurringActions.runDue()
    return id
  },
  update: (id: string, v: recurringRepo.RecurringInput) => {
    recurringRepo.updateRecurring(db, id, v)
    recurringActions.runDue()
  },
  setPaused: (id: string, paused: boolean) => {
    recurringRepo.setRecurringPaused(db, id, paused, today())
    if (!paused) recurringActions.runDue()
  },
  remove: (id: string) => recurringRepo.deleteRecurring(db, id),
  restore: (id: string) => recurringRepo.restoreRecurring(db, id),
  /** 到日子的补记上；记了几笔、哪些因为分类或钱袋不在了先暂停，用一句提示告诉用户 */
  runDue: () => {
    const { recorded, paused } = recurringRepo.runDueRecurrings(db, ledger(), today(), me())
    if (paused.length) useUi.getState().showToast(`「${paused[0]}」的分类或钱袋不在了，这条定时记账先暂停了`)
    else if (recorded) useUi.getState().showToast(`定时记账自动记了 ${recorded} 笔`)
    return recorded
  },
}

export const tagActions = {
  /** 改名；改成已有的名字就是合并 */
  rename: (from: string, to: string) => tagRepo.renameTag(db, ledger(), from, to),
  /** 删标签：账还在，只是不再带这个标签；返回删之前的样子，撤销时放回 */
  remove: (name: string) => tagRepo.deleteTag(db, ledger(), name),
  restore: (snap: tagRepo.TagSnapshot) => tagRepo.restoreTags(db, snap),
}

// 攒钱目标都建在主账本里；免费同时进行 1 个，大掌柜不限
const mainLedger = () => {
  const p = personalLedger(db)
  if (!p) throw new DomainError('找不到主账本')
  return p.id
}

export const goalActions = {
  create: (v: GoalInput) => goalRepo.createGoal(db, mainLedger(), v, today(), useAuth.getState().user?.isVip ? Infinity : 1),
  update: (id: string, v: GoalInput) => goalRepo.updateGoal(db, mainLedger(), id, v),
  archive: (id: string) => goalRepo.archiveGoal(db, id),
  fulfill: (id: string, v: { wish: string; photo: string | null }) => goalRepo.fulfillGoal(db, mainLedger(), id, v, today()),
  /** 到期没攒够：从今天起往后挪 n 个月 */
  postpone: (id: string, months: number) => goalRepo.postponeGoal(db, mainLedger(), id, shiftMonths(today(), months)),
  /** 存满的目标冻结成就，并弹出牌匾（一次只弹一块）；返回是否有新攒够的 */
  check: () => {
    const p = personalLedger(db)
    if (!p) return false
    const ids = goalRepo.checkGoals(db, p.id, today())
    if (ids.length) useUi.getState().setCelebrate({ goalId: ids[0]!, mode: 'reached' })
    return ids.length > 0
  },
  /** 转账之后：存进目标给一句鼓励；没攒够就取出不评判；攒够后取出问一句是不是去圆梦 */
  afterTransfer: (from: string, to: string | null, amountCents: number) => {
    const p = personalLedger(db)
    if (!p) return
    if (goalActions.check()) return
    const ui = useUi.getState()
    const into = goalRepo.goalByWallet(db, p.id, to)
    if (into?.status === 'active') {
      const half = crossedHalf(into.targetCents, into.balanceCents - amountCents, into.balanceCents)
      return ui.showVerse(goalCopy(half ? 'halfway' : 'progress'))
    }
    const out = goalRepo.goalByWallet(db, p.id, from)
    if (out?.status === 'active') return ui.showVerse(goalCopy('withdrawEarly'))
    if (out?.status === 'achieved' && !out.fulfilledOn) ui.setCelebrate({ goalId: out.id, mode: 'withdrawn' })
  },
}

export const templateActions = {
  create: (v: TemplateInput) => templateRepo.createTemplate(db, ledger(), v),
  update: (id: string, v: TemplateInput) => templateRepo.updateTemplate(db, id, v),
  remove: (id: string) => templateRepo.deleteTemplate(db, id),
  restore: (id: string) => templateRepo.restoreTemplate(db, id),
  reorder: (ids: string[]) => templateRepo.reorderTemplates(db, ids),
  /** 点一下记一笔（今天），返回账目 id 供撤销 */
  record: (id: string) => templateRepo.recordTemplate(db, id, me()),
  undo: (txnId: string) => templateRepo.undoRecord(db, txnId),
  get: (id: string) => templateRepo.getTemplate(db, id),
  fromTxn: (txnId: string) => templateRepo.templateFromTxn(db, txnId),
  saveByName: (v: TemplateInput) => templateRepo.saveTemplateByName(db, ledger(), v),
}

export const walletActions = {
  create: (v: { name: string; kind: WalletKind; initialCents: number }) => walletRepo.createWallet(db, ledger(), v),
  update: (id: string, v: { name: string; kind: WalletKind }) => walletRepo.updateWallet(db, id, v),
  archive: (id: string, archived: boolean) => walletRepo.setWalletArchived(db, id, archived),
  remove: (id: string) => walletRepo.deleteWallet(db, id),
  calibrate: (id: string, actualCents: number) => walletRepo.calibrateWallet(db, id, actualCents),
  hasTxns: (id: string) => walletRepo.walletHasTxns(db, id),
}

export const categoryActions = {
  create: (v: categoryRepo.CategoryInput & { type: CategoryType }) => categoryRepo.createCategory(db, ledger(), v),
  update: (id: string, v: categoryRepo.CategoryInput) => categoryRepo.updateCategory(db, id, v),
  setHidden: (id: string, hidden: boolean) => categoryRepo.setCategoryHidden(db, id, hidden),
  reorder: (ids: string[]) => categoryRepo.reorderCategories(db, ids),
  merge: (fromId: string, intoId: string) => categoryRepo.mergeCategory(db, fromId, intoId),
}

export const assetActions = {
  create: (v: { name: string; costCents: number; acquiredOn: string; note: string }) => assetRepo.createAsset(db, ledger(), v),
  update: (id: string, v: { name: string; note: string; costCents: number; acquiredOn: string }) => assetRepo.updateAsset(db, id, v),
  addUse: (id: string) => assetRepo.addUse(db, id),
  setCostMode: (id: string, mode: CostMode) => assetRepo.setCostMode(db, id, mode),
  setUseCount: (id: string, n: number) => assetRepo.setUseCount(db, id, n),
  sell: (id: string, v: { priceCents: number; date: string; walletId: string }) => assetRepo.sellAsset(db, id, v),
  end: (id: string, status: 'lost' | 'broken', date: string) => assetRepo.endAsset(db, id, status, date),
  undo: (id: string) => assetRepo.undoAssetEnd(db, id),
  remove: (id: string) => assetRepo.deleteAsset(db, id),
}

export const budgetActions = {
  /** 金额为 0 或 null 表示取消这条预算；categoryId 为 null 是总预算 */
  set: (categoryId: string | null, amountCents: number | null) => budgetRepo.setBudget(db, ledger(), categoryId, amountCents),
}

export const dayActions = {
  /** "今天没花钱"记在个人账本 */
  setNoSpend: (on: boolean) => {
    const p = personalLedger(db)
    if (p) dayRepo.setNoSpend(db, p.id, today(), on)
  },
}

function alertText(line: BudgetLine, level: AlertLevel) {
  const what = line.categoryId ? `「${line.name}」预算` : '本月预算'
  return level === 100 ? `${what}已超出 ${formatYuan(-line.leftCents)}` : `${what}已用八成，还剩 ${formatYuan(line.leftCents)}`
}

/**
 * 保存一笔支出后调用：当月花到 80%、超过 100% 时各提醒一次（总预算和这笔的分类预算），
 * 返回要显示的话，没有则返回 null。只管当月。
 */
export function budgetAlertAfterSave(categoryId: string | null, date: string): string | null {
  const month = monthOf(date)
  if (month !== monthOf(today())) return null
  const id = ledger()
  const st = budgetRepo.budgetStatus(db, id, month)
  for (const line of [st.total, st.categories.find((c) => c.categoryId === categoryId)]) {
    if (!line) continue
    const key = `budgetAlert:${id}:${month}:${line.categoryId ?? 'total'}` as const
    const level = budgetAlertLevel(line.ratio, Number(getSetting(db, key) ?? 0))
    if (!level) continue
    setSetting(db, key, String(level))
    return alertText(line, level)
  }
  return null
}

/** 点一下常记：按今天记上，盖章，提示“已记”。成功返回 true */
export function recordTemplateNow(t: { id: string; name: string }) {
  if (!attempt(() => templateActions.record(t.id))) return false
  useUi.getState().showStamp()
  useUi.getState().showToast(`已记：${t.name}`) // 不带撤销：记错了长按那笔删掉就行（用户：有删除了）
  return true
}

/** 新记一笔后调用：第 3 笔时返回一次性提示，之后都返回 null */
export function tipAfterSave(): string | null {
  const n = Number(getSetting(db, 'entriesSaved') ?? '0') + 1
  setSetting(db, 'entriesSaved', String(n))
  if (n < 3 || getSetting(db, 'tipQuickShown') === '1') return null
  setSetting(db, 'tipQuickShown', '1')
  return '长按「记」可以快速记常记'
}

/**
 * 删除一笔账（左滑删除、长按菜单、编辑页共用）：
 * 不能删的直接说明原因；能删的先确认，关联家当的提示一起删除。返回是否删掉了
 */
export async function deleteTxnFlow(t: { id: string; assetId: string | null }): Promise<boolean> {
  const blocker = txnActions.deleteBlocker(t.id)
  if (blocker) {
    showAlert('不能删除', blocker)
    return false
  }
  if (!(await confirm('删除这笔账？', t.assetId ? '关联的家当会一起删除。' : '删除后不能恢复。', '删除', true))) return false
  const cur = txnRepo.getTxn(db, t.id)
  if (!attempt(() => txnActions.remove(t.id))) return false
  if (cur) forgetPhoto(cur.photo, cur.photoFileId) // 小票照片一起删
  return true
}

/** 长按账目：编辑 / 再记一笔 / 存为常记 / 设为周期记账 / 删除（转账不能存为常记、设为周期） */
export function openTxnMenu(
  t: { id: string; type: string; assetId: string | null },
  go: { edit: () => void; copy: () => void; toTemplate: () => void; toRecurring: () => void },
) {
  useUi.getState().showActions({
    title: '这笔账',
    items: [
      { label: '编辑', onPress: go.edit },
      { label: '再记一笔', onPress: go.copy },
      ...(t.type === 'expense' || t.type === 'income'
        ? [
            { label: '存为常记', onPress: go.toTemplate },
            { label: '设为定时记账', onPress: go.toRecurring },
          ]
        : []),
      { label: '删除', danger: true, onPress: () => void deleteTxnFlow(t) },
    ],
  })
}

/** 删除一条常记（先确认）。删掉了返回 true */
export async function deleteTemplateFlow(t: { id: string; name: string }) {
  if (!(await confirm(`删除常记「${t.name}」？`, '已经记下的账不受影响。', '删除', true))) return false
  return attempt(() => templateActions.remove(t.id))
}
