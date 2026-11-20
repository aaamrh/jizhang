import { describe, expect, it } from 'vitest'
import { amountColor, contrast, MONEY_GREEN, MONEY_RED, MONEY_ZERO } from './amountColor'

describe('金额颜色', () => {
  it('支出/负数红，收入/正数绿，零墨色', () => {
    expect(amountColor(-1)).toBe(MONEY_RED)
    expect(amountColor(-12_000_000)).toBe(MONEY_RED)
    expect(amountColor(1)).toBe(MONEY_GREEN)
    expect(amountColor(0)).toBe(MONEY_ZERO)
  })

  it('红、绿在纸面上的对比度都 ≥ 4.5:1', () => {
    expect(contrast(MONEY_RED, '#FFFDF8')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(MONEY_GREEN, '#FFFDF8')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(MONEY_GREEN, '#F7F3EA')).toBeGreaterThanOrEqual(4.5)
  })
})
