import { describe, expect, it } from 'vitest'
import { cnNum, crossedHalf, durationLabel, GOAL_COPY, goalCopy, paceOf, reached, shiftMonths, tierOf, tierRank } from './goals'

describe('牌匾档位', () => {
  it('按目标金额定档，边界含下限', () => {
    expect(tierOf(99_900)).toBe('copper')
    expect(tierOf(100_000)).toBe('silver')
    expect(tierOf(499_999)).toBe('silver')
    expect(tierOf(500_000)).toBe('gold')
    expect(tierOf(2_000_000)).toBe('jade')
    expect(tierOf(4_999_999)).toBe('jade')
    expect(tierOf(5_000_000)).toBe('jubao')
    expect(tierRank('jubao')).toBeGreaterThan(tierRank('copper'))
  })
})

describe('用了多久', () => {
  it('中文数字', () => {
    expect([1, 9, 10, 12, 20, 35].map(cnNum)).toEqual(['一', '九', '十', '十二', '二十', '三十五'])
  })
  it('日、月、年', () => {
    expect(durationLabel('2026-11-01', '2026-11-01')).toBe('一日成')
    expect(durationLabel('2026-11-01', '2026-11-10')).toBe('十日成')
    expect(durationLabel('2026-08-01', '2026-11-01')).toBe('三月成')
    expect(durationLabel('2025-11-01', '2026-11-01')).toBe('一年成')
    expect(durationLabel('2025-05-01', '2026-11-01')).toBe('一年半成')
    expect(durationLabel('2024-11-01', '2026-11-01')).toBe('两年成')
  })
})

describe('进度提示', () => {
  it('没有期限只算还差多少', () => {
    expect(paceOf(2_000_000, 500_000, null, '2026-11-18')).toEqual({ remainingCents: 1_500_000, monthsLeft: null, perMonthCents: null, overdue: false })
  })
  it('有期限：每月还要存多少（向上取整）', () => {
    const p = paceOf(1_000_000, 100_000, '2027-02-17', '2026-11-18')
    expect(p.monthsLeft).toBe(3)
    expect(p.perMonthCents).toBe(300_000)
  })
  it('过了期限', () => {
    expect(paceOf(1_000_000, 0, '2026-10-01', '2026-11-18').overdue).toBe(true)
  })
  it('达成判定', () => {
    expect(reached(100_000, 100_000)).toBe(true)
    expect(reached(100_000, 99_999)).toBe(false)
    expect(reached(0, 0)).toBe(false)
  })
})


describe('文案', () => {
  it('不出现苛责的字眼', () => {
    const all = Object.values(GOAL_COPY).flatMap((m) => [m.plain, ...m.verses.map((v) => v.verse)]).join('')
    for (const w of ['失败', '放弃', '可惜', '没用']) expect(all.includes(w)).toBe(false)
  })
})

describe('延期', () => {
  it('往后挪 n 个月，月底不越界', () => {
    expect(shiftMonths('2026-11-18', 1)).toBe('2026-12-18')
    expect(shiftMonths('2026-11-18', 3)).toBe('2027-02-18')
    expect(shiftMonths('2026-08-31', 6)).toBe('2027-02-28')
  })
})

describe('诗句轮换', () => {
  it('每个时刻至少两句；随机取，但不会连着两次同一句', () => {
    for (const [kind, m] of Object.entries(GOAL_COPY)) {
      expect(m.verses.length).toBeGreaterThanOrEqual(2)
      let prev = ''
      for (let i = 0; i < 50; i++) {
        const v = goalCopy(kind as keyof typeof GOAL_COPY, () => (i % 3) / 3)
        expect(v.verse).not.toBe(prev)
        expect(v.plain).toBe(m.plain)
        prev = v.verse
      }
    }
  })
  it('过半：刚好跨过一半才算', () => {
    expect(crossedHalf(10_000, 4_000, 5_000)).toBe(true)
    expect(crossedHalf(10_000, 5_000, 6_000)).toBe(false)
    expect(crossedHalf(10_000, 4_000, 10_000)).toBe(false) // 直接攒够，算攒够
  })
})
