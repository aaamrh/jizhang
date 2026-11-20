import { describe, expect, it } from 'vitest'
import { legacyReview, necessityOf } from './necessity'

describe('necessityOf', () => {
  it('复盘标记优先', () => {
    expect(necessityOf('unnecessary', 'need')).toBe('unnecessary')
    expect(necessityOf('necessary', 'want')).toBe('necessary')
  })
  it('没标记按档位：必需→必要，享受→非必要，弹性和未设档位→待定', () => {
    expect(necessityOf(null, 'need')).toBe('necessary')
    expect(necessityOf(null, 'want')).toBe('unnecessary')
    expect(necessityOf(null, 'flex')).toBe('pending')
    expect(necessityOf(null, null)).toBe('pending')
  })
})

describe('legacyReview', () => {
  it('值→必要，悔→非必要，一般和跳过→没复盘', () => {
    expect(legacyReview('worth')).toBe('necessary')
    expect(legacyReview('regret')).toBe('unnecessary')
    expect(legacyReview('ok')).toBeNull()
    expect(legacyReview('skip')).toBeNull()
    expect(legacyReview('necessary')).toBe('necessary')
    expect(legacyReview(null)).toBeNull()
  })
})
