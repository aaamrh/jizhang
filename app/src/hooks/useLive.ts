import { useEffect, useMemo, useState } from 'react'
import { subscribeDb } from '../db/client'

// 全局只订阅一次数据库变化；一个事务会触发很多行级事件，合并成一次刷新
let version = 0
let pending = false
let unsubscribe: (() => void) | null = null
const listeners = new Set<() => void>()

function onDbChange() {
  version++
  if (pending) return
  pending = true
  setTimeout(() => {
    pending = false
    listeners.forEach((l) => l())
  }, 0)
}

function useDbVersion() {
  const [v, setV] = useState(version)
  useEffect(() => {
    const l = () => setV(version)
    listeners.add(l)
    unsubscribe ??= subscribeDb(onDbChange)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return v
}

/** 实时查询：数据库有写入时自动重新执行 read，界面随之刷新 */
export function useLive<T>(read: () => T, deps: unknown[]): T {
  const v = useDbVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(read, [v, ...deps])
}
