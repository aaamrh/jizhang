import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { flameLevel, milestoneToday, streakInfo } from './streak'

const run = (end: string, n: number) => Array.from({ length: n }, (_, i) => addDays(end, -i))

describe('连续记账的火苗', () => {
  it('今天还没记、或者断了，是灰火星；记了按天数分档', () => {
    expect(flameLevel({ streak: 5, todayCounted: false })).toBe(0)
    expect(flameLevel({ streak: 0, todayCounted: false })).toBe(0)
    expect(flameLevel({ streak: 1, todayCounted: true })).toBe(1)
    expect(flameLevel({ streak: 6, todayCounted: true })).toBe(1)
    expect(flameLevel({ streak: 7, todayCounted: true })).toBe(2)
    expect(flameLevel({ streak: 21, todayCounted: true })).toBe(3)
    expect(flameLevel({ streak: 30, todayCounted: true })).toBe(4)
    expect(flameLevel({ streak: 100, todayCounted: true })).toBe(5)
  })
  it('只在跨过关口的那天庆祝', () => {
    expect(milestoneToday({ streak: 7, todayCounted: true })?.title).toBe('七日不辍')
    expect(milestoneToday({ streak: 8, todayCounted: true })).toBeNull()
    expect(milestoneToday({ streak: 7, todayCounted: false })).toBeNull()
  })
  it('最长连续：断了以后也留着', () => {
    const days = [...run('2026-11-10', 12), ...run('2026-11-18', 3)]
    const s = streakInfo(days, '2026-11-18')
    expect(s.streak).toBe(3)
    expect(s.longest).toBe(12)
  })
})
