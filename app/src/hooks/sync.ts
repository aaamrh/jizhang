// 什么时候同步：打开 App、本地写入后约 2 秒、回到前台、前台每 30 秒、首页下拉
import { useCallback, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { sync as syncApi } from '../api/accountApi'
import { db, subscribeDb } from '../db/client'
import { getLedger, personalLedger } from '../db/ledgerRepo'
import { hasDirty, runSync } from '../db/sync'
import { useAuth } from '../store/authStore'
import { useSettings } from '../store/settingsStore'
import { runRefresh } from '../utils/refresh'
import { uploadPendingPhotos } from './photo'

let running: Promise<void> | null = null
let again = false

/** 当前账本被删除（被移出、解散）时回到个人账本 */
export function fixCurrentLedger() {
  const s = useSettings.getState()
  if (!getLedger(db, s.currentLedgerId)) {
    const p = personalLedger(db)
    if (p) s.setLedger(p.id)
  }
}

/** 同步一次；已在同步时排队再来一次。没登录或没同意同步时什么都不做 */
export function syncNow(): Promise<void> {
  const auth = useAuth.getState()
  if (!auth.token || !auth.syncConsent) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    auth.setSyncStatus({ syncing: true })
    try {
      do {
        again = false
        const r = await runSync(db, syncApi)
        // 家庭账本管理员给我开了长辈模式
        if (r.elderOn) useSettings.getState().setElderMode(true)
        fixCurrentLedger()
      } while (again)
      useAuth.getState().setSyncStatus({ syncing: false, lastSyncAt: Date.now(), syncError: null })
      void uploadPendingPhotos() // 账本到了云端之后，补传本机照片
    } catch (e: any) {
      useAuth.getState().setSyncStatus({ syncing: false, syncError: e?.message ?? '同步失败' })
    } finally {
      running = null
    }
  })()
  return running
}

/** App 就绪后调用一次，返回停止函数 */
export function startSync(onForeground: () => void) {
  void syncNow()
  let timer: ReturnType<typeof setTimeout> | undefined
  // 同步自己写入的数据 dirty = false，所以只在本地真的改过时才会触发，不会循环
  const unsubscribe = subscribeDb(() => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (hasDirty(db)) void syncNow()
    }, 2000)
  })
  const interval = setInterval(() => {
    if (AppState.currentState === 'active') void syncNow()
  }, 30_000)
  const sub = AppState.addEventListener('change', (s) => {
    if (s !== 'active') return
    void syncNow()
    onForeground()
  })
  return () => {
    clearTimeout(timer)
    clearInterval(interval)
    unsubscribe()
    sub.remove()
  }
}

/**
 * 列表下拉刷新：refreshing 由自己管（不直接绑同步状态），保证每次都会收回；刷新没结束时再拉不重复执行。
 * 和左滑删除的手势分工见 components/SwipeRow。
 */
export function usePullRefresh(task: () => Promise<unknown> = syncNow) {
  const [refreshing, setRefreshing] = useState(false)
  const busy = useRef(false)
  const onRefresh = useCallback(() => {
    if (busy.current) return
    void runRefresh(task, (v) => {
      busy.current = v
      setRefreshing(v)
    })
  }, [task])
  return { refreshing, onRefresh }
}
