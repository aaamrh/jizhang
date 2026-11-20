import { describe, expect, it } from 'vitest'
import { monthGrid, periodLabel, periodRange, shiftPeriod } from './dates'

describe('periodRange / shiftPeriod / periodLabel', () => {
  it('周一到下周一、整月、整年', () => {
    expect(periodRange('week', '2026-11-19')).toEqual({ start: '2026-11-16', end: '2026-11-23' })
    expect(periodRange('month', '2026-12-05')).toEqual({ start: '2026-12-01', end: '2027-01-01' })
    expect(periodRange('year', '2026-06-30')).toEqual({ start: '2026-01-01', end: '2027-01-01' })
  })
  it('前后移动', () => {
    expect(shiftPeriod('week', '2026-11-19', -1)).toBe('2026-11-09')
    expect(shiftPeriod('month', '2026-01-31', -1)).toBe('2025-12-01')
    expect(shiftPeriod('year', '2026-06-30', 1)).toBe('2027-01-01')
  })
  it('标题', () => {
    expect(periodLabel('week', '2026-11-19', '2026-11-17')).toBe('本周')
    expect(periodLabel('year', '2026-06-30')).toBe('2026年')
  })
})

describe('monthGrid', () => {
  it('2026-11：周日开始，前面空 6 格，30 天，补满整周', () => {
    const g = monthGrid('2026-11')
    expect(g.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01'])
    expect(g.filter(Boolean)).toHaveLength(30)
    expect(g.length % 7).toBe(0)
  })
  it('闰年 2 月有 29 天', () => {
    expect(monthGrid('2028-02').filter(Boolean)).toHaveLength(29)
  })
})
