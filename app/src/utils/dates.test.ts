import { describe, expect, it } from 'vitest'
import { addDays, monthGrid, periodBlockText, periodLabel, periodRange, pickerGrid, shiftPeriod, weekLabel, weekStartOf } from './dates'

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

describe('选周：weekStartOf / weekLabel', () => {
  it('点哪天都落到那周周一；周日、跨年也对', () => {
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16') // 周一
    expect(weekStartOf('2026-11-19')).toBe('2026-11-16')
    expect(weekStartOf('2026-11-22')).toBe('2026-11-16') // 周日
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28')
  })
  it('上周：本周周一往前 7 天；底下写的是周一到周日', () => {
    expect(addDays(weekStartOf('2026-11-23'), -7)).toBe('2026-11-16')
    expect(weekLabel('2026-11-16')).toBe('11月16日 – 11月22日')
  })
})

describe('periodBlockText', () => {
  it('月、年：小字年份 / 大字月份，全年 / 2026年', () => {
    expect(periodBlockText('month', '2026-11-19')).toEqual({ small: '2026年', big: '11月' })
    expect(periodBlockText('year', '2026-06-30')).toEqual({ small: '全年', big: '2026年' })
  })
  it('周：同月写几号到几号，本周加注；跨月、跨年写月.日', () => {
    expect(periodBlockText('week', '2026-11-19', '2026-11-17')).toEqual({ small: '2026年11月 · 本周', big: '16–22日' })
    expect(periodBlockText('week', '2026-11-19', '2026-11-30')).toEqual({ small: '2026年11月', big: '16–22日' })
    expect(periodBlockText('week', '2026-10-28', '2026-11-30')).toEqual({ small: '2026年', big: '10.26–11.1' })
    expect(periodBlockText('week', '2026-12-31', '2027-01-01')).toEqual({ small: '2026年 · 本周', big: '12.28–1.3' })
  })
})

describe('pickerGrid', () => {
  it('2026-11：1 号是周日，前面补 10 月 26–31 日，后面补到 12 月 6 日，正好 6 行', () => {
    const g = pickerGrid('2026-11')
    expect(g).toHaveLength(42)
    expect(g.slice(0, 7).map((c) => c.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(g.slice(0, 6).every((c) => !c.inMonth)).toBe(true)
    expect(g[6]!.inMonth).toBe(true)
    expect(g.filter((c) => c.inMonth)).toHaveLength(30)
    expect(g[41]).toEqual({ date: '2026-12-06', inMonth: false })
  })
  it('1 号是周一的月份：第一行就从 1 号开始', () => {
    expect(pickerGrid('2026-06')[0]).toEqual({ date: '2026-06-01', inMonth: true })
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
