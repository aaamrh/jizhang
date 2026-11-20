// 攒钱目标与如愿匾：纯计算，不依赖 RN。金额一律“分”，日期 'YYYY-MM-DD'

export type PlaqueTier = 'copper' | 'silver' | 'gold' | 'jade' | 'jubao'

/** 牌匾档位（唯一配置处）：按目标金额定档，min 为下限（含），单位分 */
export const PLAQUE_TIERS: readonly { tier: PlaqueTier; name: string; minCents: number }[] = [
  { tier: 'jubao', name: '聚宝盆', minCents: 5_000_000 },
  { tier: 'jade', name: '玉', minCents: 2_000_000 },
  { tier: 'gold', name: '金', minCents: 500_000 },
  { tier: 'silver', name: '银', minCents: 100_000 },
  { tier: 'copper', name: '铜', minCents: 0 },
]

const ORDER: PlaqueTier[] = ['copper', 'silver', 'gold', 'jade', 'jubao']

export function tierOf(targetCents: number): PlaqueTier {
  return PLAQUE_TIERS.find((t) => targetCents >= t.minCents)?.tier ?? 'copper'
}

export const tierName = (t: PlaqueTier) => PLAQUE_TIERS.find((x) => x.tier === t)!.name
/** 档位高低，用于如愿排序：聚宝盆 4 … 铜 0 */
export const tierRank = (t: PlaqueTier) => ORDER.indexOf(t)

const DAY = 86_400_000
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`)
export const daysBetween = (from: string, to: string) => Math.round((ms(to) - ms(from)) / DAY)

const DIGITS = '零一二三四五六七八九'
/** 1..99 → 中文数字：1 一，10 十，12 十二，20 二十，35 三十五 */
export function cnNum(n: number): string {
  if (n < 10) return DIGITS[n]!
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return `${tens === 1 ? '' : DIGITS[tens]}十${ones ? DIGITS[ones] : ''}`
}

/** 用了多久：“十日成”、“三月成”、“一年成”、“一年半成”、“两年成” */
export function durationLabel(from: string, to: string): string {
  const days = Math.max(1, daysBetween(from, to) + 1)
  if (days < 30) return `${cnNum(days)}日成`
  const months = Math.round(days / 30.44)
  if (months < 12) return `${cnNum(Math.max(1, months))}月成`
  const halfYears = Math.round(months / 6)
  const years = Math.floor(halfYears / 2)
  const half = halfYears % 2 === 1
  const y = years === 2 ? '两' : cnNum(years)
  return `${y}年${half ? '半' : ''}成`
}

export interface Pace {
  remainingCents: number
  /** 离期限还有几个月（向上取整，至少 1）；没有期限或已过期为 null */
  monthsLeft: number | null
  /** 每月还要存多少；没有期限或已过期为 null */
  perMonthCents: number | null
  overdue: boolean
}

/** 进度提示：还差多少；有期限时每月还要存多少 */
export function paceOf(targetCents: number, balanceCents: number, deadline: string | null, today: string): Pace {
  const remainingCents = Math.max(0, targetCents - balanceCents)
  if (!deadline) return { remainingCents, monthsLeft: null, perMonthCents: null, overdue: false }
  const days = daysBetween(today, deadline)
  if (days < 0) return { remainingCents, monthsLeft: null, perMonthCents: null, overdue: true }
  const monthsLeft = Math.max(1, Math.ceil(days / 30.44))
  return { remainingCents, monthsLeft, perMonthCents: Math.ceil(remainingCents / monthsLeft), overdue: false }
}

/** 目标第一次达成：余额 ≥ 目标。达成后冻结，之后取出也不撤销 */
export const reached = (targetCents: number, balanceCents: number) => targetCents > 0 && balanceCents >= targetCents

// ───────── 文案：古诗一句（霞鹜文楷）+ 一句白话 + 出处。温和，不苛责：攒钱是为了好好生活 ─────────
export interface Verse {
  verse: string
  author: string
  plain: string
}

/** 所有攒钱目标的文案都在这里，改文案只改这一处：每个时刻一句白话 + 一组古诗（随机轮换，不连着重复） */
export const GOAL_COPY = {
  create: {
    plain: '想要的，值得慢慢攒',
    verses: [
      { verse: '千里之行，始于足下。', author: '老子' },
      { verse: '不积跬步，无以至千里。', author: '荀子《劝学》' },
      { verse: '合抱之木，生于毫末。', author: '老子' },
      { verse: '长风破浪会有时，直挂云帆济沧海。', author: '李白《行路难》' },
    ],
  },
  progress: {
    plain: '每一笔，都离它近一点',
    verses: [
      { verse: '春种一粒粟，秋收万颗子。', author: '李绅《悯农》' },
      { verse: '积土成山，风雨兴焉。', author: '荀子《劝学》' },
      { verse: '不积小流，无以成江海。', author: '荀子《劝学》' },
      { verse: '绳锯木断，水滴石穿。', author: '罗大经《鹤林玉露》' },
    ],
  },
  halfway: {
    plain: '过半了，最难的一段已经走完',
    verses: [
      { verse: '千淘万漉虽辛苦，吹尽狂沙始到金。', author: '刘禹锡《浪淘沙》' },
      { verse: '锲而不舍，金石可镂。', author: '荀子《劝学》' },
    ],
  },
  reached: {
    plain: '攒够了，攒钱是为了好好生活',
    verses: [
      { verse: '人生得意须尽欢，莫使金樽空对月。', author: '李白《将进酒》' },
      { verse: '花开堪折直须折，莫待无花空折枝。', author: '杜秋娘《金缕衣》' },
      { verse: '会当凌绝顶，一览众山小。', author: '杜甫《望岳》' },
    ],
  },
  fulfilled: {
    plain: '此行不虚，愿你常有出发的勇气',
    verses: [
      { verse: '春风得意马蹄疾，一日看尽长安花。', author: '孟郊《登科后》' },
      { verse: '两岸猿声啼不住，轻舟已过万重山。', author: '李白《早发白帝城》' },
      { verse: '仰天大笑出门去，我辈岂是蓬蒿人。', author: '李白《南陵别儿童入京》' },
      { verse: '采菊东篱下，悠然见南山。', author: '陶渊明《饮酒》' },
    ],
  },
  withdrawEarly: {
    plain: '先顾眼前也没关系，目标一直在',
    verses: [
      { verse: '天生我材必有用，千金散尽还复来。', author: '李白《将进酒》' },
      { verse: '且将新火试新茶，诗酒趁年华。', author: '苏轼《望江南》' },
      { verse: '山重水复疑无路，柳暗花明又一村。', author: '陆游《游山西村》' },
    ],
  },
  overdue: {
    plain: '慢一点也很好，要不要往后挪挪？',
    verses: [
      { verse: '莫听穿林打叶声，何妨吟啸且徐行。', author: '苏轼《定风波》' },
      { verse: '行到水穷处，坐看云起时。', author: '王维《终南别业》' },
      { verse: '沉舟侧畔千帆过，病树前头万木春。', author: '刘禹锡《酬乐天扬州初逢席上见赠》' },
    ],
  },
} satisfies Record<string, { plain: string; verses: { verse: string; author: string }[] }>

export type GoalCopyKind = keyof typeof GOAL_COPY

const lastShown = new Map<GoalCopyKind, string>()

/** 随机取一句，不和上一次显示的重复（每个时刻各记各的） */
export function goalCopy(kind: GoalCopyKind, rand: () => number = Math.random): Verse {
  const { plain, verses } = GOAL_COPY[kind]
  const pool = verses.length > 1 ? verses.filter((v) => v.verse !== lastShown.get(kind)) : verses
  const v = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!
  lastShown.set(kind, v.verse)
  return { ...v, plain }
}

/** 这一笔存进去，进度是不是刚好跨过一半 */
export const crossedHalf = (targetCents: number, beforeCents: number, afterCents: number) =>
  targetCents > 0 && beforeCents * 2 < targetCents && afterCents * 2 >= targetCents && afterCents < targetCents

/** 到期没攒够：一键延期，从今天起往后挪 n 个月 */
export const POSTPONE_MONTHS = [1, 3, 6] as const
export function shiftMonths(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/** 牌匾的状态：攒够了待圆梦 / 已圆梦 */
export type PlaqueStage = 'reached' | 'fulfilled'
