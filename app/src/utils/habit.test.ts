import { describe, expect, it } from 'vitest'
import { budgetAlertLevel, budgetProgress } from './budget'
import { daysLeftInMonth, weekLabel, weekStartOf } from './dates'
import { longestStreak, streakInfo } from './streak'

describe('连续记账', () => {
  const today = '2026-11-17'

  it('今天记过：从今天往回数', () => {
    expect(streakInfo(['2026-11-15', '2026-11-16', '2026-11-17'], today)).toEqual({ streak: 3, todayCounted: true, total: 3, longest: 3 })
  })

  it('今天还没记：算到昨天为止，不立刻算断', () => {
    expect(streakInfo(['2026-11-15', '2026-11-16'], today)).toMatchObject({ streak: 2, todayCounted: false })
  })

  it('中间断了一天：只算断点之后', () => {
    expect(streakInfo(['2026-11-10', '2026-11-11', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'], today).streak).toBe(5)
    expect(streakInfo(['2026-11-14', '2026-11-15'], today)).toMatchObject({ streak: 0, total: 2 })
  })

  it('补记昨天、重复日期、未来日期', () => {
    const days = ['2026-11-17', '2026-11-16', '2026-11-16', '2026-12-01'] // 补记的昨天 + 重复 + 记在未来的账
    expect(streakInfo(days, today)).toEqual({ streak: 2, todayCounted: true, total: 2, longest: 2 })
  })

  it('跨月、跨年', () => {
    expect(streakInfo(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01').streak).toBe(3)
  })

  it('最长连续', () => {
    expect(longestStreak(['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-02'])).toBe(3)
    expect(longestStreak([])).toBe(0)
    expect(longestStreak(['2024-02-28', '2024-02-29', '2024-03-01'])).toBe(3) // 闰年
  })
})

describe('预算', () => {
  it('剩余、日均可花；超支时没有日均', () => {
    expect(budgetProgress(300_000, 180_000, 12)).toEqual({
      budgetCents: 300_000,
      spentCents: 180_000,
      leftCents: 120_000,
      ratio: 0.6,
      daysLeft: 12,
      perDayCents: 10_000,
    })
    expect(budgetProgress(1000, 1200, 5)).toMatchObject({ leftCents: -200, perDayCents: null })
    expect(budgetProgress(1000, 0, 0).perDayCents).toBeNull() // 月份已过
    expect(budgetProgress(1000, 1, 3).perDayCents).toBe(333) // 向下取整，不会算多
  })

  it('80% 和超过 100% 各提醒一次', () => {
    expect(budgetAlertLevel(0.79, 0)).toBeNull()
    expect(budgetAlertLevel(0.8, 0)).toBe(80)
    expect(budgetAlertLevel(0.9, 80)).toBeNull()
    expect(budgetAlertLevel(1, 80)).toBeNull() // 正好花完不算超
    expect(budgetAlertLevel(1.01, 80)).toBe(100)
    expect(budgetAlertLevel(1.5, 0)).toBe(100) // 一笔直接超了：只提醒超支
    expect(budgetAlertLevel(2, 100)).toBeNull()
  })
})

describe('周和月的日期', () => {
  it('周一开始', () => {
    expect(weekStartOf('2026-11-17')).toBe('2026-11-16') // 周二
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16') // 周一
    expect(weekStartOf('2026-11-22')).toBe('2026-11-16') // 周日
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28') // 跨年
    expect(weekLabel('2026-11-16')).toBe('11月16日 – 11月22日')
  })

  it('本月剩余天数含今天', () => {
    expect(daysLeftInMonth('2026-11', '2026-11-17')).toBe(14)
    expect(daysLeftInMonth('2026-11', '2026-11-30')).toBe(1)
    expect(daysLeftInMonth('2026-10', '2026-11-17')).toBe(0)
    expect(daysLeftInMonth('2026-12', '2026-11-17')).toBe(31)
    expect(daysLeftInMonth('2024-02', '2024-02-01')).toBe(29)
  })
})
