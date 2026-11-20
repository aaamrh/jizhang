import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runRefresh } from './refresh'

describe('下拉刷新不会卡住', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('任务很快：至少转 minMs 再收回（避免 true→false 同帧合并）', async () => {
    const states: boolean[] = []
    const p = runRefresh(async () => {}, (v) => states.push(v), { minMs: 600 })
    await vi.advanceTimersByTimeAsync(599)
    expect(states).toEqual([true])
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(states).toEqual([true, false])
  })

  it('任务一直不结束：超时后收回', async () => {
    const states: boolean[] = []
    const p = runRefresh(() => new Promise(() => {}), (v) => states.push(v), { timeoutMs: 15_000 })
    await vi.advanceTimersByTimeAsync(15_000)
    await p
    expect(states).toEqual([true, false])
  })

  it('任务出错（同步失败、断网）：照样收回', async () => {
    const states: boolean[] = []
    const p = runRefresh(() => Promise.reject(new Error('网络错误')), (v) => states.push(v), { minMs: 0 })
    await vi.runAllTimersAsync()
    await p
    expect(states).toEqual([true, false])
  })

  it('任务同步抛错也收回', async () => {
    const states: boolean[] = []
    const p = runRefresh(() => { throw new Error('x') }, (v) => states.push(v), { minMs: 0 })
    await vi.runAllTimersAsync()
    await p
    expect(states.at(-1)).toBe(false)
  })
})
