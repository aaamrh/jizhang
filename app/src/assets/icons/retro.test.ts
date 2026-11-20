import { describe, expect, it } from 'vitest'
import { RETRO_GROUPS, RETRO_ICONS } from './retro'

const DEFAULT_CATEGORIES = [
  '住房', '水电燃气', '通讯网费', '通勤', '买菜', '医疗', '保险', '人情往来',
  '外出就餐', '打车', '日用', '服饰', '数码', '聚会请客', '育儿', '宠物', '学习',
  '零食饮品', '娱乐', '旅行', '烟酒', '游戏',
  '工资', '奖金', '副业', '理财收益', '红包礼金', '变卖', '其他',
]

const icons = Object.entries(RETRO_ICONS)

describe('复古图标', () => {
  it('每个图标至少一条路径，坐标都在 0..24 内', () => {
    for (const [name, ic] of icons) {
      expect(ic.paths.length, name).toBeGreaterThan(0)
      for (const d of ic.paths) {
        // 只看绝对坐标的大致范围：所有数字（含相对偏移、弧半径、标志位）都不应超出画布
        for (const n of d.match(/-?\d*\.?\d+/g) ?? []) expect(Math.abs(Number(n)), `${name}: ${d}`).toBeLessThanOrEqual(24)
      }
      for (const c of ic.circles ?? []) {
        expect(c.cx - c.r, name).toBeGreaterThanOrEqual(0)
        expect(c.cy - c.r, name).toBeGreaterThanOrEqual(0)
        expect(c.cx + c.r, name).toBeLessThanOrEqual(24)
        expect(c.cy + c.r, name).toBeLessThanOrEqual(24)
      }
    }
  })

  it('每个默认分类恰好对应一个图标', () => {
    const claimed = icons.flatMap(([, ic]) => ic.defaultFor ?? [])
    expect([...claimed].sort()).toEqual([...DEFAULT_CATEGORIES].sort())
  })

  it('标签不重复；分组都合法；关键词 3–6 个', () => {
    const labels = icons.map(([, ic]) => ic.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const [name, ic] of icons) {
      expect([...RETRO_GROUPS, '导航'], name).toContain(ic.group)
      if (ic.group !== '导航') {
        expect(ic.keywords.length, name).toBeGreaterThanOrEqual(3)
        expect(ic.keywords.length, name).toBeLessThanOrEqual(6)
      }
    }
  })

  it('图标库至少 60 个，含导航图标和兜底图标', () => {
    expect(icons.length).toBeGreaterThanOrEqual(60)
    for (const n of ['tab-ledger', 'tab-abacus', 'tab-chest', 'tab-me', 'misc']) expect(RETRO_ICONS[n], n).toBeDefined()
  })
})
