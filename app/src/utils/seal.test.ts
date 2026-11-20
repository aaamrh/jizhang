import { describe, expect, it } from 'vitest'
import { sealChars, sealWear } from './seal'

describe('圆梦印章', () => {
  it('四个字从右列往左列排', () => {
    const c = sealChars('春华秋实')
    expect(c.map((x) => x.ch).join('')).toBe('春华秋实')
    expect(c[0]!.x).toBeGreaterThan(c[2]!.x) // 第一个字在右边
    expect(c[0]!.y).toBeLessThan(c[1]!.y) // 同一列先上后下
  })
  it('两个字上下竖排，一个字居中', () => {
    const two = sealChars('入账')
    expect(two[0]!.x).toBe(two[1]!.x)
    expect(two[0]!.y).toBeLessThan(two[1]!.y)
    expect(sealChars('账')[0]!.x).toBe(50)
  })
  it('同一块匾斑驳固定，不同的匾不一样，且都在印面内', () => {
    const a = sealWear('手机2026.11.18')
    expect(sealWear('手机2026.11.18')).toEqual(a)
    expect(sealWear('看海2026.12.01')).not.toEqual(a)
    for (const s of a) {
      if (s.kind === 'dot') {
        expect(s.cx).toBeGreaterThanOrEqual(0)
        expect(s.cx).toBeLessThanOrEqual(100)
        expect(s.cy).toBeGreaterThanOrEqual(0)
        expect(s.cy).toBeLessThanOrEqual(100)
      } else {
        expect(s.x + s.w).toBeLessThanOrEqual(100)
        expect(s.y + s.h).toBeLessThanOrEqual(100)
      }
    }
  })
})
