import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import * as ledgerApi from '../api/ledgerApi'
import { useAuth } from '../store/authStore'
import type { Member, Review, Tier, TxnView } from '../types/domain'
import { periodRange } from '../utils/dates'
import { feedByDay, feedCategories, feedSummary, type FamilyFeed, type FeedItem } from '../utils/familyFeed'
import { COLOR_KEYS, parseIcon, type ColorKey } from '../utils/iconCatalog'
import { whoLabel } from '../utils/members'

// 同一段时间的结果先留在内存里：来回切账本、翻月份时先显示上次的，再静默刷新
const cache = new Map<string, FamilyFeed>()

/**
 * 家庭账本某段日期 [start, end) 的汇总，从服务器取（家庭账本不在本机存别人的账）。
 * 每次同步完自动再取一次：自己刚记的账同步上去后，家庭账本里马上能看到。
 * error：'inactive' = 创建者的大掌柜到期了，非创建者暂时看不到；'network' = 没取到（先显示上次的）。
 */
export function useFamilyFeed(ledgerId: string | null, start: string, end: string) {
  const key = ledgerId ? `${ledgerId}|${start}|${end}` : ''
  const [feed, setFeed] = useState<FamilyFeed | null>(() => cache.get(key) ?? null)
  const [error, setError] = useState<'inactive' | 'network' | null>(null)
  const [loading, setLoading] = useState(false)
  const lastSyncAt = useAuth((s) => s.lastSyncAt)
  const current = useRef(key)
  current.current = key

  const reload = useCallback(async () => {
    if (!ledgerId) return
    const k = key
    setLoading(true)
    try {
      const f = await ledgerApi.familyFeed(ledgerId, start, end)
      cache.set(k, f)
      if (current.current === k) {
        setFeed(f)
        setError(null)
      }
    } catch (e) {
      if (current.current === k) setError(e instanceof ApiError && e.code === 'family_inactive' ? 'inactive' : 'network')
    } finally {
      if (current.current === k) setLoading(false)
    }
  }, [ledgerId, start, end, key])

  useEffect(() => {
    setFeed(cache.get(key) ?? null)
    setError(null)
  }, [key])
  useEffect(() => {
    void reload()
  }, [reload, lastSyncAt])

  return { feed, error, loading, reload }
}

const asColor = (c: string | undefined): ColorKey => ((COLOR_KEYS as readonly string[]).includes(c ?? '') ? (c as ColorKey) : 'mo')
const REVIEWS: Review[] = ['necessary', 'unnecessary']

/** 汇总里的一笔 → 列表行用的 TxnView（没有钱袋：钱袋是各人自己的） */
export function feedToView(t: FeedItem, ledgerId: string): TxnView {
  return {
    id: t.id,
    ledgerId,
    type: t.type,
    amountCents: t.amountCents,
    categoryId: null,
    walletId: '',
    toWalletId: null,
    date: t.date,
    note: t.note,
    assetId: null,
    review: REVIEWS.includes(t.review as Review) ? (t.review as Review) : null,
    createdBy: t.userId,
    memberId: null,
    tags: [], // 家庭账本里不显示别人的标签（标签是各人整理自己账用的）
    recurringId: null,
    photo: null, // 家庭账本里不显示照片
    photoFileId: null,
    photoCachedFor: null,
    createdAt: t.createdAt,
    categoryName: t.category?.name ?? null,
    categoryIcon: t.category ? parseIcon(t.category.icon, t.category.name) : null,
    categoryColor: asColor(t.category?.color),
    tier: (t.category?.tier as Tier | null) ?? null,
    walletName: '',
    toWalletName: null,
  }
}

/** 家庭账本的一个月：汇总、按天分组的账目（首页用） */
export function useFamilyMonth(ledgerId: string | null, month: string) {
  const { start, end } = periodRange('month', `${month}-01`)
  const r = useFamilyFeed(ledgerId, start, end)
  const view = useMemo(() => {
    const items = r.feed?.items ?? []
    return {
      summary: feedSummary(items),
      groups: feedByDay(items).map((g) => ({ ...g, items: g.items.map((t) => feedToView(t, ledgerId ?? '')) })),
    }
  }, [r.feed, ledgerId])
  return { ...r, ...view }
}

/** 家庭账本一段时间的统计（盘账用）：汇总、分类排行、谁记了多少 */
export function useFamilyPeriod(ledgerId: string | null, start: string, end: string, members: Member[]) {
  const r = useFamilyFeed(ledgerId, start, end)
  const view = useMemo(() => {
    const items = r.feed?.items ?? []
    const byUser = new Map<string, { name: string; cents: number }>()
    for (const t of items) {
      if (t.type === 'income') continue
      const key = t.userId ?? ''
      const cur = byUser.get(key) ?? { name: whoLabel({ createdBy: t.userId }, members), cents: 0 }
      cur.cents += (t.type === 'expense' ? 1 : -1) * t.amountCents
      byUser.set(key, cur)
    }
    return {
      summary: feedSummary(items),
      count: items.length,
      categories: feedCategories(items).map((c) => ({ ...c, icon: parseIcon(c.icon, c.name), color: asColor(c.color) })),
      byMember: [...byUser.entries()].map(([key, v]) => ({ key, ...v })).filter((m) => m.cents > 0).sort((a, b) => b.cents - a.cents),
    }
  }, [r.feed, members])
  return { ...r, ...view }
}
