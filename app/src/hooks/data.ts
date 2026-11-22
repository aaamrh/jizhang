// 页面读数据都通过这里：按当前账本查询，数据库一变自动刷新
import { db } from '../db/client'
import { getAsset, listAssets } from '../db/assetRepo'
import { budgetStatus, listBudgets } from '../db/budgetRepo'
import { getCategory, listCategories } from '../db/categoryRepo'
import { hasNoSpend, recordedDays } from '../db/dayRepo'
import { hasTxnsInYear, weekReport, yearReport } from '../db/reportRepo'
import { listLedgers, listMembers, myMember, personalLedger } from '../db/ledgerRepo'
import { dailySpend, monthSummary, rangeSummary } from '../db/statsRepo'
import { necessityOf, type Necessity } from '../utils/necessity'
import { countAllTxns, countTxns, getTxn, listEntries, listMonthTxns, listTagTxns, type EntriesQuery, reviewCandidates, reviewedList, searchTxns } from '../db/txnRepo'
import { allTagTotals, recentTags, tagTotalsIn } from '../db/tagRepo'
import { getWallet, listWallets } from '../db/walletRepo'
import { useAuth } from '../store/authStore'
import { useSettings } from '../store/settingsStore'
import type { CategoryType, TxnView } from '../types/domain'
import { dayLabel, monthOf, periodRange, shiftMonth, today, type PeriodKind } from '../utils/dates'
import { streakInfo } from '../utils/streak'
import { useLive } from './useLive'
import { listTemplates } from '../db/templateRepo'
import { listGoals } from '../db/goalRepo'
import { listRecurrings } from '../db/recurringRepo'

const useLedgerId = () => useSettings((s) => s.currentLedgerId)

export const useLedgers = () => useLive(() => listLedgers(db), [])

export function useCurrentLedger() {
  const id = useLedgerId()
  const ledgers = useLedgers()
  return ledgers.find((l) => l.id === id) ?? ledgers[0]
}

/** 我在的家庭账本（可以有好几个），和正在看的那个（null = 在看我的账本；退出了的、旧版存的 '1' 当作第一个） */
export function useFamilies() {
  const families = useLedgers().filter((l) => l.type === 'family')
  const v = useSettings((s) => s.familyView)
  const viewed = v ? (families.find((l) => l.id === v) ?? (v === '1' ? families[0] : undefined)) : undefined
  return { families, viewed: viewed ?? null }
}

/** 周期记账：当前账本（我的账本）的周期账，带分类、钱袋名和下一次的日子 */
export function useRecurrings() {
  const id = useLedgerId()
  return useLive(() => listRecurrings(db, id, today()), [id])
}

/** 常记：当前账本的常记 */
export function useTemplates() {
  const id = useLedgerId()
  return useLive(() => listTemplates(db, id), [id])
}

/** includeJars：连储钱罐一起（钱袋页、转账时） */
export function useWallets(includeArchived = false, ledgerId?: string, includeJars = false) {
  const cur = useLedgerId()
  const id = ledgerId ?? cur
  return useLive(() => listWallets(db, id, includeArchived, includeJars), [id, includeArchived, includeJars])
}

/** 攒钱目标：都在主账本里 */
export function useGoals() {
  return useLive(() => {
    const p = personalLedger(db)
    return p ? listGoals(db, p.id) : []
  }, [])
}

export const useWallet = (id?: string) => useLive(() => (id ? getWallet(db, id) : undefined), [id])

export function useCategories(type?: CategoryType, includeHidden = false) {
  const id = useLedgerId()
  return useLive(() => listCategories(db, id, { type, includeHidden }), [id, type, includeHidden])
}

export const useCategory = (id?: string) => useLive(() => (id ? getCategory(db, id) : undefined), [id])

export function useAssets() {
  const id = useLedgerId()
  return useLive(() => listAssets(db, id), [id])
}

export const useAsset = (id: string) => useLive(() => getAsset(db, id), [id])
export const useTxn = (id?: string) => useLive(() => (id ? getTxn(db, id) : undefined), [id])

export interface DayGroup {
  date: string
  label: string
  expenseCents: number
  incomeCents: number
  items: TxnView[]
}

/** 流水首页：月度汇总 + 按日分组的账目 + 待复盘笔数 */
export function useMonthView(month: string, excludeAssets: boolean) {
  const id = useLedgerId()
  return useLive(() => {
    const summary = monthSummary(db, id, month, excludeAssets)
    const groups: DayGroup[] = []
    for (const t of listMonthTxns(db, id, month)) {
      let g = groups.at(-1)
      if (!g || g.date !== t.date) {
        g = { date: t.date, label: dayLabel(t.date), expenseCents: 0, incomeCents: 0, items: [] }
        groups.push(g)
      }
      g.items.push(t)
      if (t.type === 'expense') g.expenseCents += t.amountCents
      if (t.type === 'income') g.incomeCents += t.amountCents
    }
    return { summary, groups, reviewCount: reviewCandidates(db, id, month).length, txnTotal: countTxns(db, id) }
  }, [id, month, excludeAssets])
}

/** 复盘页“已复盘”：本月标记过的几笔（实时刷新，改了立刻更新） */
export function useReviewed(month: string) {
  const id = useLedgerId()
  return useLive(() => reviewedList(db, id, month), [id, month])
}

/** 盘账里点开一个分类：这段时间的每一笔（可按必要性筛选） */
/** 一段时间的支出明细（分类 / 必要性 / 整月），见 db/txnRepo listEntries */
export function useEntries(q: EntriesQuery | null) {
  const id = useLedgerId()
  return useLive(() => (q ? listEntries(db, id, q) : []), [id, q?.start, q?.end, q?.categoryId, q?.necessity, q?.excludeAssets])
}

export function useSearch(q: string) {
  const id = useLedgerId()
  return useLive(() => searchTxns(db, id, q), [id, q])
}

export function useBudgets() {
  const id = useLedgerId()
  return useLive(() => listBudgets(db, id), [id])
}

export function useBudgetStatus(month: string) {
  const id = useLedgerId()
  return useLive(() => budgetStatus(db, id, month), [id, month])
}

/** 连续 / 累计记账天数（跨账本），以及今天有没有点“今天没花钱” */
export function useStreak() {
  return useLive(() => {
    const day = today()
    return { ...streakInfo(recordedDays(db), day), noSpendToday: hasNoSpend(db, day) }
  }, [])
}

/** 盘账“周”视图：最大的一笔、记了几天；不是周视图时传 null，不查 */
export function useWeekReport(start: string | null) {
  const id = useLedgerId()
  return useLive(() => (start ? weekReport(db, id, start) : null), [id, start])
}

export function useYearReport(year: number, filter: Necessity | 'all' = 'all') {
  const id = useLedgerId()
  return useLive(() => yearReport(db, id, year, today(), filter), [id, year, filter])
}

/** 1 月份首页提示看去年的年度报告（去年有账才提示） */
export function useLastYearReportHint() {
  const id = useLedgerId()
  return useLive(() => {
    const now = today()
    const year = Number(now.slice(0, 4)) - 1
    return now.slice(5, 7) === '01' && hasTxnsInYear(db, id, year) ? year : null
  }, [id])
}

/**
 * 账目只在这台手机上时，在首页提一句开启云同步（一般用户不会自己去找同步按钮）：
 * 记满 7 天（账攒起来、值得保管了）才第一次提；点了 × 或 30 天内导出过备份，30 天内不再提。
 * 没登录的提“登录开启云同步”，登录了没同意的提“开启云同步”
 */
export function useSyncNudge(): 'login' | 'sync' | null {
  const quietSince = useSettings((s) => Math.max(s.lastExportAt ?? 0, s.syncNudgeAt ?? 0))
  const auth = useAuth((s) => (!s.token ? 'login' : s.syncConsent ? 'synced' : 'sync'))
  const days = useLive(() => recordedDays(db).length, [])
  if (auth === 'synced' || days < 7 || Date.now() - quietSince < 30 * 86_400_000) return null
  return auth
}

/** 账本成员（家庭账本的家人）；默认当前账本 */
export function useMembers(ledgerId?: string) {
  const cur = useLedgerId()
  const id = ledgerId ?? cur
  return useLive(() => listMembers(db, id), [id])
}

/** 我在当前账本里的成员身份 */
export function useMyMember() {
  const id = useLedgerId()
  return useLive(() => myMember(db, id), [id])
}

/** 盘账：周 / 月 / 年的收支汇总 */
export function usePeriodStats(kind: PeriodKind, anchor: string, excludeAssets: boolean, filter: Necessity | 'all' = 'all') {
  const id = useLedgerId()
  return useLive(() => {
    const { start, end } = periodRange(kind, anchor)
    return rangeSummary(db, id, start, end, excludeAssets, filter)
  }, [id, kind, anchor, excludeAssets, filter])
}

/** 盘账柱状图、同期对比：[start, end) 每天的净支出 */
export function useDailySpend(start: string, end: string, excludeAssets: boolean, filter: Necessity | 'all' = 'all') {
  const id = useLedgerId()
  return useLive(() => dailySpend(db, id, start, end, excludeAssets, filter), [id, start, end, excludeAssets, filter])
}

/** 选标签：最近用过的在前 */
export function useRecentTags() {
  const id = useLedgerId()
  return useLive(() => recentTags(db, id), [id])
}

/** 盘账“按标签”：周 / 月 / 年里每个标签花了多少 */
export function usePeriodTags(kind: PeriodKind, anchor: string) {
  const id = useLedgerId()
  return useLive(() => {
    const { start, end } = periodRange(kind, anchor)
    return tagTotalsIn(db, id, start, end)
  }, [id, kind, anchor])
}

/** 所有标签（不分时间） */
export function useAllTags() {
  const id = useLedgerId()
  return useLive(() => allTagTotals(db, id), [id])
}

/** 带某个标签的所有账 */
export function useTagTxns(name: string) {
  const id = useLedgerId()
  return useLive(() => listTagTxns(db, id, name), [id, name])
}

/** “我的”页：所有账本的记账笔数 */
export const useTxnCount = () => useLive(() => countAllTxns(db), [])
