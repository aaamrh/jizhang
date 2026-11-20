import type { Review, Tier } from '../types/domain'

/** 一笔支出必不必要：复盘时标记过的以标记为准；没标记的按分类档位推定，弹性类算“待定” */
export type Necessity = 'necessary' | 'unnecessary' | 'pending'

export const NECESSITIES: Necessity[] = ['necessary', 'unnecessary', 'pending']
export const NECESSITY_LABEL: Record<Necessity, string> = { necessary: '必要', unnecessary: '非必要', pending: '待定' }

/** 盘账、周账、年账顶部的筛选 */
export const NECESSITY_FILTERS: { value: Necessity | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'necessary', label: '必要' },
  { value: 'unnecessary', label: '非必要' },
  { value: 'pending', label: '待定' },
]

export function necessityOf(review: Review | null, tier: Tier | null): Necessity {
  if (review) return review
  if (tier === 'need') return 'necessary'
  if (tier === 'want') return 'unnecessary'
  return 'pending'
}

/** 旧版本的复盘值（值 / 一般 / 悔 / 跳过）→ 新值；无法对应的当作没复盘 */
export function legacyReview(v: string | null | undefined): Review | null {
  if (v === 'necessary' || v === 'worth') return 'necessary'
  if (v === 'unnecessary' || v === 'regret') return 'unnecessary'
  return null
}
