import { describe, expect, it } from 'vitest'
import { evaluate, hasOperator, pressKey, type CalcKey } from './calc'

const type = (keys: string, start = '') => [...keys].reduce((e, k) => pressKey(e, (k === '<' ? 'back' : k) as CalcKey), start)

describe('pressKey', () => {
  it('普通输入、小数最多两位、前导零', () => {
    expect(type('12.345')).toBe('12.34')
    expect(type('007')).toBe('7')
    expect(type('.5')).toBe('0.5')
    expect(type('1..2')).toBe('1.2')
  })
  it('运算符：不能开头、连按替换、去掉悬空小数点', () => {
    expect(type('+5')).toBe('5')
    expect(type('5+-3')).toBe('5-3')
    expect(type('5.+3')).toBe('5+3')
    expect(type('5+.5')).toBe('5+0.5')
  })
  it('每个数最多 9 位整数；退格', () => {
    expect(type('1234567890')).toBe('123456789')
    expect(type('12<3')).toBe('13')
    expect(type('<')).toBe('')
  })
})

describe('evaluate', () => {
  it('用“分”计算，没有浮点误差', () => {
    expect(evaluate('0.1+0.2')).toBe(30)
    expect(evaluate('12.5+3-0.35')).toBe(1515)
    expect(evaluate('19.99+0.01')).toBe(2000)
  })
  it('末尾运算符忽略；空或不合法返回 null；可以算出负数', () => {
    expect(evaluate('8+')).toBe(800)
    expect(evaluate('')).toBeNull()
    expect(evaluate('1.234')).toBeNull()
    expect(evaluate('5-8')).toBe(-300)
  })
  it('hasOperator', () => {
    expect(hasOperator('12')).toBe(false)
    expect(hasOperator('12+')).toBe(false)
    expect(hasOperator('12+3')).toBe(true)
  })
})
