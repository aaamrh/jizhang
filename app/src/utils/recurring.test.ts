import { describe, expect, it } from 'vitest'
import { freqLabel, nextDate, occurrences, periodEnd } from './recurring'

describe('周期记账的日子', () => {
  it('每天、每周：从开始那天起，含首尾，不超过结束日', () => {
    const day = { freq: 'day' as const, startDate: '2026-11-28', endDate: '2026-12-02' }
    expect(occurrences(day, '2026-11-01', '2026-12-31')).toEqual(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'])
    expect(occurrences(day, '2026-12-01', '2026-12-31')).toEqual(['2026-12-01', '2026-12-02'])
    const week = { freq: 'week' as const, startDate: '2026-11-02', endDate: null }
    expect(occurrences(week, '2026-11-10', '2026-11-30')).toEqual(['2026-11-16', '2026-11-23', '2026-11-30'])
    expect(freqLabel(week)).toBe('每周一')
  })

  it('每月同一号：没有这一号的月份记在月底；每年 2 月 29 日平年记 28 日', () => {
    const month = { freq: 'month' as const, startDate: '2026-01-31', endDate: null }
    expect(occurrences(month, '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
    expect(occurrences({ ...month, startDate: '2027-12-15' }, '2027-12-01', '2028-02-29')).toEqual(['2027-12-15', '2028-01-15', '2028-02-15'])
    const year = { freq: 'year' as const, startDate: '2028-02-29', endDate: null }
    expect(occurrences(year, '2028-01-01', '2032-12-31')).toEqual(['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29'])
    expect(freqLabel(month)).toBe('每月 31 日')
    expect(freqLabel(year)).toBe('每年 2 月 29 日')
  })

  it('选了周几、几号、几月：从开始日（含）之后第一个对得上的日子起', () => {
    // 2026-11-20 是周五
    const week = { freq: 'week' as const, startDate: '2026-11-20', endDate: null, day: 1 }
    expect(occurrences(week, '2026-11-01', '2026-12-07')).toEqual(['2026-11-23', '2026-11-30', '2026-12-07'])
    expect(occurrences({ ...week, day: 5 }, '2026-11-20', '2026-11-27')).toEqual(['2026-11-20', '2026-11-27'])
    expect(occurrences({ ...week, day: 7 }, '2026-11-25', '2026-12-06')).toEqual(['2026-11-29', '2026-12-06'])
    expect(freqLabel({ ...week, day: 7 })).toBe('每周日')
    const month = { freq: 'month' as const, startDate: '2026-11-20', endDate: null, day: 5 }
    expect(occurrences(month, '2026-11-01', '2027-01-31')).toEqual(['2026-12-05', '2027-01-05'])
    // 31 号从 11 月起：11 月没有 31 号，记在 30 号，不跳过
    expect(occurrences({ ...month, day: 31 }, '2026-11-01', '2027-02-28')).toEqual(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28'])
    expect(freqLabel(month)).toBe('每月 5 日')
    const year = { freq: 'year' as const, startDate: '2026-11-20', endDate: null, month: 3, day: 8 }
    expect(occurrences(year, '2026-01-01', '2028-12-31')).toEqual(['2027-03-08', '2028-03-08'])
    expect(occurrences({ ...year, month: 12, day: 1 }, '2026-01-01', '2027-12-31')).toEqual(['2026-12-01', '2027-12-01'])
    expect(freqLabel(year)).toBe('每年 3 月 8 日')
  })

  it('这一期的最后一天', () => {
    expect(periodEnd('day', '2026-11-20')).toBe('2026-11-20')
    expect(periodEnd('week', '2026-11-20')).toBe('2026-11-22')
    expect(periodEnd('week', '2026-11-22')).toBe('2026-11-22')
    expect(periodEnd('month', '2028-02-10')).toBe('2028-02-29')
    expect(periodEnd('year', '2026-11-20')).toBe('2026-12-31')
  })

  it('还没到开始日、范围为空；一次最多补 limit 笔；下一次', () => {
    const day = { freq: 'day' as const, startDate: '2026-12-01', endDate: null }
    expect(occurrences(day, '2026-11-01', '2026-11-30')).toEqual([])
    expect(occurrences(day, '2026-12-01', '2027-12-31', 3)).toEqual(['2026-12-01', '2026-12-02', '2026-12-03'])
    expect(nextDate({ freq: 'month', startDate: '2026-01-15', endDate: null }, '2026-11-15')).toBe('2026-12-15')
    expect(nextDate({ freq: 'month', startDate: '2026-01-15', endDate: '2026-11-30' }, '2026-11-15')).toBeNull()
  })
})
