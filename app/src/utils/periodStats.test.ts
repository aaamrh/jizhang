import { describe, expect, it } from 'vitest'
import { averageLabel, compareText, feedDailySpend, prevAverage, samePeriod, spendBuckets, sumSpend } from './periodStats'

describe('samePeriod', () => {
  it('没过完的月：到今天为止，上月从 1 号数同样多天', () => {
    const p = samePeriod('month', '2026-11-05', '2026-11-22')
    expect(p.cur).toEqual({ start: '2026-11-01', end: '2026-11-23' })
    expect(p.prev).toEqual({ start: '2026-10-01', end: '2026-10-23' })
    expect(p.days).toBe(22)
    expect(p.complete).toBe(false)
  })
  it('过完了的月比整月；3 月 31 天比 2 月只比到 2 月底', () => {
    const p = samePeriod('month', '2026-03-10', '2026-11-22')
    expect(p.complete).toBe(true)
    expect(p.days).toBe(31)
    expect(p.prev).toEqual({ start: '2026-02-01', end: '2026-03-01' })
  })
  it('本周周一：只有 1 天，上周也只比周一', () => {
    const p = samePeriod('week', '2026-11-23', '2026-11-23')
    expect(p.days).toBe(1)
    expect(p.prev).toEqual({ start: '2026-11-16', end: '2026-11-17' })
  })
  it('今年：1 月 1 日到今天，去年同样多天', () => {
    const p = samePeriod('year', '2026-06-01', '2026-01-31')
    expect(p.cur).toEqual({ start: '2026-01-01', end: '2026-02-01' })
    expect(p.prev).toEqual({ start: '2025-01-01', end: '2025-02-01' })
    expect(p.prevFull).toEqual({ start: '2025-01-01', end: '2026-01-01' })
  })
})

describe('sumSpend / feedDailySpend', () => {
  const rows = [
    { date: '2026-10-05', cents: 100 },
    { date: '2026-10-25', cents: 300 },
  ]
  it('同期只算到某天之前', () => {
    expect(sumSpend(rows)).toBe(400)
    expect(sumSpend(rows, '2026-10-23')).toBe(100)
  })
  it('家庭账：退款冲减，收入不算，按天合并', () => {
    const r = feedDailySpend([
      { date: '2026-11-01', type: 'expense', amountCents: 500 },
      { date: '2026-11-01', type: 'refund', amountCents: 200 },
      { date: '2026-11-02', type: 'income', amountCents: 9999 },
    ])
    expect(r).toEqual([{ date: '2026-11-01', cents: 300 }])
  })
})

describe('spendBuckets', () => {
  it('周：七根，横轴一到日，今天以后标成未到', () => {
    const b = spendBuckets('week', '2026-11-18', [{ date: '2026-11-17', cents: 520 }], '2026-11-18')
    expect(b.map((x) => x.axis).join('')).toBe('一二三四五六日')
    expect(b[1]).toMatchObject({ key: '2026-11-17', cents: 520, future: false, name: '11月17日' })
    expect(b[3]!.future).toBe(true)
  })
  it('月：每天一根，横轴只写 1、5、10……和月底（31 号时不写 30，免得挤）', () => {
    const b = spendBuckets('month', '2026-10-01', [], '2026-12-01')
    expect(b).toHaveLength(31)
    expect(b.filter((x) => x.axis).map((x) => x.axis)).toEqual(['1', '5', '10', '15', '20', '25', '31'])
    const nov = spendBuckets('month', '2026-11-01', [], '2026-12-01')
    expect(nov.filter((x) => x.axis).map((x) => x.axis)).toEqual(['1', '5', '10', '15', '20', '25', '30'])
  })
  it('年：十二根，按月合计，明细是整月', () => {
    const b = spendBuckets('year', '2026-03-03', [
      { date: '2026-03-01', cents: 10 },
      { date: '2026-03-31', cents: 5 },
      { date: '2026-04-01', cents: 7 },
    ], '2026-04-15')
    expect(b).toHaveLength(12)
    expect(b[2]).toMatchObject({ axis: '3', cents: 15, start: '2026-03-01', end: '2026-04-01', name: '3月' })
    expect(b[4]!.future).toBe(true)
  })
})

describe('compareText / prevAverage', () => {
  it('没过完写同期，过完了不写；只陈述', () => {
    // 金额都是分
    expect(compareText('month', 120000, 100000, false)).toBe('比上月同期多花 ¥200')
    expect(compareText('week', 80000, 100000, true)).toBe('比上周少花 ¥200')
    expect(compareText('year', 500, 500, false)).toBe('和去年同期持平')
    expect(compareText('month', 30000, 50000, false, '非必要')).toBe('非必要比上月同期少花 ¥200')
  })
  it('上一段同期没花钱就不比', () => {
    expect(compareText('month', 300, 0, false)).toBeNull()
  })
  it('日均按上一段的天数，年是月均', () => {
    expect(prevAverage('month', { start: '2026-10-01', end: '2026-11-01' }, 3100)).toBe(100)
    expect(prevAverage('year', { start: '2025-01-01', end: '2026-01-01' }, 1200)).toBe(100)
    expect(averageLabel('year')).toBe('去年月均')
  })
})
