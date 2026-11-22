import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPENSE, DEFAULT_INCOME } from '../db/seed'
import { assetCost, perDayAfter } from './assetCost'
import { addDays, dayLabel, daysInclusive, monthRange, shiftMonth } from './dates'
import { defaultIconFor, formatIcon, ICONS, isIconName, legacyIcon, parseIcon, suggestIcon } from './iconCatalog'
import { centsToInput, formatPlain, formatShare, formatSigned, formatYuan, parseYuan } from './money'
import { uuidv5 } from './uuidv5'

describe('money', () => {
  it('parseYuan 严格解析，最多两位小数', () => {
    expect(parseYuan('12')).toBe(1200)
    expect(parseYuan('12.5')).toBe(1250)
    expect(parseYuan('12.05')).toBe(1205)
    expect(parseYuan(' 0.1 ')).toBe(10)
    expect(parseYuan('12.')).toBe(1200)
    expect(parseYuan('0.29')).toBe(29) // 浮点 0.29*100 = 28.999…，这里不能错
    for (const bad of ['', '-1', '1.234', 'abc', '1,000', '.5']) expect(parseYuan(bad)).toBeNull()
  })

  it('formatYuan 千分位、符号', () => {
    expect(formatYuan(123456789)).toBe('¥1,234,567.89')
    expect(formatYuan(-1250)).toBe('-¥12.5')
    expect(formatYuan(5, true)).toBe('+¥0.05')
    expect(formatYuan(0, true)).toBe('¥0')
  })

  it('显示金额：整数不带小数，去掉末尾 0', () => {
    expect(formatPlain(12000000)).toBe('120,000')
    expect(formatPlain(1250)).toBe('12.5')
    expect(formatPlain(302)).toBe('3.02')
    expect(formatPlain(50)).toBe('0.5')
    expect(formatPlain(0)).toBe('0')
    expect(formatSigned(-123456789)).toBe('-1,234,567.89')
  })

  it('centsToInput 回填', () => {
    expect(centsToInput(1200)).toBe('12')
    expect(centsToInput(1250)).toBe('12.5')
    expect(centsToInput(1205)).toBe('12.05')
  })
})

describe('dates', () => {
  it('daysInclusive：同一天算 1 天，跨月跨闰年', () => {
    expect(daysInclusive('2026-11-17', '2026-11-17')).toBe(1)
    expect(daysInclusive('2026-01-31', '2026-02-01')).toBe(2)
    expect(daysInclusive('2024-02-28', '2024-03-01')).toBe(3) // 闰年 2/29
    expect(daysInclusive('2025-02-28', '2025-03-01')).toBe(2)
    expect(daysInclusive('2025-12-31', '2026-01-01')).toBe(2)
  })

  it('月份运算', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' })
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('dayLabel', () => {
    expect(dayLabel('2026-11-17', '2026-11-17')).toBe('今天')
    expect(dayLabel('2026-11-16', '2026-11-17')).toBe('昨天')
    expect(dayLabel('2026-11-10', '2026-11-17')).toBe('11月10日 周二')
  })
})

describe('assetCost', () => {
  const phone = { costCents: 600000, soldCents: null, acquiredOn: '2026-01-01', endedOn: null, useCount: 0 }

  it('持有中：天数到今天，次数 0 不算每次', () => {
    const c = assetCost(phone, '2026-01-10')
    expect(c.days).toBe(10)
    expect(c.perDayCents).toBe(60000)
    expect(c.perUseCents).toBeNull()
    expect(c.profitCents).toBeNull()
    expect(perDayAfter(c, 180)).toBe(Math.round(600000 / 190))
  })

  it('卖出：扣掉卖价，算盈亏', () => {
    const c = assetCost({ ...phone, soldCents: 200000, endedOn: '2026-01-04', useCount: 3 }, '2027-01-01')
    expect(c.days).toBe(4)
    expect(c.netCents).toBe(400000)
    expect(c.perDayCents).toBe(100000)
    expect(c.perUseCents).toBe(133333)
    expect(c.profitCents).toBe(-400000)
  })

  it('丢失：结束日是丢失那天，没有卖价', () => {
    const c = assetCost({ ...phone, endedOn: '2026-01-01' }, '2027-01-01')
    expect(c.days).toBe(1)
    expect(c.perDayCents).toBe(600000)
  })
})

describe('iconCatalog（复古图标）', () => {
  it('目录名字不重复，导航图标不在分类目录里', () => {
    const names = ICONS.map((i) => i.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.length).toBeGreaterThanOrEqual(60)
    expect(names.some((n) => n.startsWith('tab-'))).toBe(false)
  })

  it('默认分类的图标都在目录里，并且就是 retro.ts 的 defaultFor 指定的那个', () => {
    for (const [, name, icon] of [...DEFAULT_EXPENSE, ...DEFAULT_INCOME]) {
      expect(isIconName(icon), name).toBe(true)
      expect(defaultIconFor(name), name).toBe(icon)
    }
  })

  it('按名称推荐图标', () => {
    expect(suggestIcon('奶茶')).toBe('lidded-cup')
    expect(suggestIcon('打车')).toBe('rickshaw')
    expect(suggestIcon('房租')).toBe('house')
    expect(suggestIcon('猫粮')).toBe('cat')
    expect(suggestIcon('工资')).toBe('coin')
    expect(suggestIcon('健身卡')).toBe('taiji')
    expect(suggestIcon('　')).toBeNull()
    expect(suggestIcon('zzz')).toBeNull()
  })

  it('图标存储格式解析；旧版 Lucide 值映射到最接近的复古图标', () => {
    expect(parseIcon('retro:bowl-chopsticks', '餐')).toEqual({ kind: 'retro', name: 'bowl-chopsticks' })
    expect(parseIcon('char:食', '餐')).toEqual({ kind: 'char', char: '食' })
    expect(parseIcon('lucide:utensils', '外出就餐')).toEqual({ kind: 'retro', name: 'bowl-chopsticks' })
    expect(parseIcon('lucide:not-exist', '猫粮')).toEqual({ kind: 'retro', name: 'cat' }) // 表里没有：按名称推荐
    expect(parseIcon('lucide:not-exist', 'zzz')).toEqual({ kind: 'retro', name: 'misc' }) // 再不行：祥云
    expect(parseIcon('retro:no-such', '餐饮')).toEqual({ kind: 'char', char: '餐' })
    expect(parseIcon(null, '𠀀字')).toEqual({ kind: 'char', char: '𠀀' })
    expect(formatIcon({ kind: 'retro', name: 'misc' })).toBe('retro:misc')
    expect(legacyIcon('car-taxi-front', '打车')).toBe('rickshaw')
  })
})

describe('uuidv5', () => {
  it('与标准测试向量一致，且结果稳定', () => {
    // RFC 4122 DNS 命名空间的公认示例
    expect(uuidv5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2')
    expect(uuidv5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d')
    const ns = '6f1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e'
    expect(uuidv5('expense.dining', ns)).toBe(uuidv5('expense.dining', ns))
    expect(uuidv5('expense.dining', ns)).not.toBe(uuidv5('expense.taxi', ns))
    expect(uuidv5('中文键', ns)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('formatShare', () => {
  it('不到 1% 写 <1%，0 写 0%，总数为 0 不写', () => {
    expect(formatShare(139, 1350491)).toBe('<1%')
    expect(formatShare(0, 100)).toBe('0%')
    expect(formatShare(50, 100)).toBe('50%')
    expect(formatShare(5, 0)).toBe('')
  })
})
