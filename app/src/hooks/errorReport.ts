import { Platform } from 'react-native'
import { reportErrors } from '../api/appApi'
import { db } from '../db/client'
import { getSetting, setSetting } from '../db/settingsRepo'
import { useSettings } from '../store/settingsStore'
import { appVersion } from './appVersion'

// 出错上报：页面出错（白屏兜底）和闪退前，把出错信息和代码位置先存在本机，同意隐私政策后再发给服务器。
// 只发出错信息，不发账目。最多攒 10 条，发出去就清掉

type Report = { message: string; stack: string; fatal: boolean; at: number }
const MAX_KEEP = 10

const pending = (): Report[] => {
  try {
    const v = JSON.parse(getSetting(db, 'pendingErrors') ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** 记下一条出错（数据库还没准备好时就算了，不能因为上报再出错） */
export function recordError(e: unknown, fatal: boolean, extra = '') {
  try {
    const err = e instanceof Error ? e : new Error(String(e))
    const r: Report = {
      message: `${err.name}: ${err.message}`.slice(0, 500),
      stack: `${err.stack ?? ''}${extra ? `\n--- 组件 ---${extra}` : ''}`.slice(0, 4000),
      fatal,
      at: Date.now(),
    }
    setSetting(db, 'pendingErrors', JSON.stringify([...pending(), r].slice(-MAX_KEEP)))
  } catch {
    // 忽略
  }
  if (!fatal) void flushErrors()
}

let sending = false

/** 把攒下的出错发给服务器：同意隐私政策后、启动时、记下新的一条时 */
export async function flushErrors() {
  const s = useSettings.getState()
  if (sending || !s.privacyAgreed || !s.deviceId) return
  const reports = pending()
  if (!reports.length) return
  sending = true
  try {
    await reportErrors({ deviceId: s.deviceId, platform: Platform.OS === 'ios' ? 'ios' : 'android', appVersion: appVersion(), reports })
    // 发送期间又记下的留着，下次再发
    setSetting(db, 'pendingErrors', JSON.stringify(pending().filter((r) => !reports.some((x) => x.at === r.at && x.message === r.message))))
  } catch {
    // 没网：下次再发
  } finally {
    sending = false
  }
}

/** 接管全局未捕获的错误：先记下来，再交给系统原来的处理（闪退或红屏） */
export function installGlobalErrorHandler() {
  const g = globalThis as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }
  const eu = g.ErrorUtils
  if (!eu) return
  const prev = eu.getGlobalHandler()
  eu.setGlobalHandler((e, fatal) => {
    recordError(e, !!fatal)
    prev(e, fatal)
  })
}
