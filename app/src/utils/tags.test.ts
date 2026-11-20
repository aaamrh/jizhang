import { describe, expect, it } from 'vitest'
import { cleanTags, normalizeTag, parseTags, recentTagNames, replaceTag, spendByMonth, tagsJson, tagTotals } from './tags'

describe('标签', () => {
  it('规范化：去空白、压空格、超长截断（按字）', () => {
    expect(normalizeTag('  云南  旅行 ')).toBe('云南 旅行')
    expect(normalizeTag('一二三四五六七八九十十一')).toBe('一二三四五六七八九十')
    expect(cleanTags(['报销', ' 报销', '', '  ', '装修'])).toEqual(['报销', '装修'])
  })

  it('解析：坏数据当作没有标签', () => {
    expect(parseTags('["云南旅行","报销"]')).toEqual(['云南旅行', '报销'])
    expect(parseTags('[1,"装修",null]')).toEqual(['装修'])
    expect(parseTags('不是 JSON')).toEqual([])
    expect(parseTags('{"a":1}')).toEqual([])
    expect(parseTags(null)).toEqual([])
    expect(tagsJson([' 装修', '装修'])).toBe('["装修"]')
  })

  it('最近用过：按出现顺序去重', () => {
    expect(recentTagNames([{ tags: ['报销'] }, { tags: ['云南旅行', '报销'] }, { tags: ['装修'] }], 2)).toEqual(['报销', '云南旅行'])
  })

  it('合计：一笔两个标签两边都算；退款冲减；转账只计笔数；一样多按笔数', () => {
    const rows = [
      { type: 'expense', amountCents: 46_000, tags: ['报销', '出差'] },
      { type: 'expense', amountCents: 21_600, tags: ['报销'] },
      { type: 'refund', amountCents: 21_600, tags: ['报销'] },
      { type: 'income', amountCents: 10_000, tags: ['出差'] },
      { type: 'transfer', amountCents: 5_000, tags: ['出差'] },
      { type: 'transfer', amountCents: 3_000, tags: ['出差'] },
      { type: 'refund', amountCents: 9_000, tags: ['退多了'] },
    ]
    expect(tagTotals(rows)).toEqual([
      { name: '出差', spendCents: 46_000, incomeCents: 10_000, count: 4 },
      { name: '报销', spendCents: 46_000, incomeCents: 0, count: 3 },
      { name: '退多了', spendCents: 0, incomeCents: 0, count: 1 },
    ])
  })

  it('改名合并、删除', () => {
    expect(replaceTag(['云南', '报销'], '云南', '云南旅行')).toEqual(['云南旅行', '报销'])
    expect(replaceTag(['云南', '云南旅行'], '云南', '云南旅行')).toEqual(['云南旅行'])
    expect(replaceTag(['云南', '报销'], '云南', null)).toEqual(['报销'])
  })

  it('按月：跨月分开算，退款冲减，只列花了钱的月份', () => {
    const rows = [
      { type: 'expense', amountCents: 386_000, date: '2026-10-20' },
      { type: 'expense', amountCents: 128_000, date: '2026-10-26' },
      { type: 'expense', amountCents: 240_000, date: '2026-11-10' },
      { type: 'refund', amountCents: 40_000, date: '2026-11-12' },
      { type: 'income', amountCents: 9_000, date: '2026-12-01' },
    ]
    expect(spendByMonth(rows)).toEqual([
      { month: '2026-10', cents: 514_000 },
      { month: '2026-11', cents: 200_000 },
    ])
  })
})
