import { addDays } from './dates'

export interface StreakInfo {
  /** 连续记账天数。今天还没记时，算到昨天为止（不立刻算断） */
  streak: number
  todayCounted: boolean
  /** 累计记账天数（不含未来日期） */
  total: number
  /** 历史最长连续天数（断了以后也留着，算个纪念） */
  longest: number
}

/** days：记过账的日期（有账目或点了“今天没花钱”），可以重复、无序 */
export function streakInfo(days: Iterable<string>, today: string): StreakInfo {
  const set = new Set(days)
  const todayCounted = set.has(today)
  let streak = 0
  for (let d = todayCounted ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) streak++
  let total = 0
  for (const d of set) if (d <= today) total++
  const longest = Math.max(streak, longestStreak([...set].filter((d) => d <= today)))
  return { streak, todayCounted, total, longest }
}

/**
 * 连续记账的火苗档位，天数越多火越旺（像游戏里的连杀）：
 * 0 灰火星（今天还没记、或已经断了）；1 火星 1–6 天；2 火苗 7–20；3 旺火 21–29；4 烈火 30–99；5 燎原 100 天以上。
 */
export type FlameLevel = 0 | 1 | 2 | 3 | 4 | 5
export function flameLevel(s: { streak: number; todayCounted: boolean }): FlameLevel {
  if (!s.todayCounted || s.streak <= 0) return 0
  return s.streak >= 100 ? 5 : s.streak >= 30 ? 4 : s.streak >= 21 ? 3 : s.streak >= 7 ? 2 : 1
}

export interface StreakMilestone {
  days: number
  title: string
  line: string
  verse: string
}

/** 关口：跨过的那天记完一笔，弹一张小卡片庆祝。古话加一句白话，不说教 */
export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 7, title: '七日不辍', line: '连续记账 7 天。一周的钱花在哪，心里有数了。', verse: '“锲而不舍，金石可镂。”' },
  { days: 21, title: '习惯已成', line: '连续 21 天，记账已经是顺手的事。', verse: '“不积跬步，无以至千里。”' },
  { days: 30, title: '持之以恒', line: '整整一个月，每天都在账上。', verse: '“绳锯木断，水滴石穿。”' },
  { days: 100, title: '百日之功', line: '一百天。火已经旺得很了。', verse: '“星星之火，可以燎原。”' },
  { days: 365, title: '岁岁不辍', line: '一整年，每一天都记下了。', verse: '“日日行，不怕千万里。”' },
]

/** 今天刚好跨过的关口（今天记了、连续天数正好是关口天数）；没有就 null */
export function milestoneToday(s: { streak: number; todayCounted: boolean }): StreakMilestone | null {
  if (!s.todayCounted) return null
  return STREAK_MILESTONES.find((m) => m.days === s.streak) ?? null
}

/** 最长连续天数（年度报告用，传入当年的日期） */
export function longestStreak(days: Iterable<string>): number {
  const sorted = [...new Set(days)].sort()
  let best = 0
  let run = 0
  sorted.forEach((d, i) => {
    run = i > 0 && addDays(sorted[i - 1]!, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
  })
  return best
}
