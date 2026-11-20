import * as LocalAuthentication from 'expo-local-authentication'
import { showAlert } from '../components/dialogs'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useSettings } from '../store/settingsStore'
import { useUi } from '../store/uiStore'

const LOCK_AFTER_MS = 60_000

/** 在后台超过 1 分钟再回来时上锁（冷启动的上锁在 useBootstrap 里） */
export function useAppLockWatcher() {
  const leftAt = useRef<number | null>(null)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now()
      if (state === 'active' && leftAt.current !== null) {
        if (useSettings.getState().lockEnabled && Date.now() - leftAt.current > LOCK_AFTER_MS) useUi.getState().setLocked(true)
        leftAt.current = null
      }
    })
    return () => sub.remove()
  }, [])
}

/** 指纹、面容或手机密码验证 */
export async function authenticate() {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: '解锁账房', cancelLabel: '取消' })
  return r.success
}

/** 开启应用锁前确认手机设置了锁屏方式，并验证一次 */
export async function enableAppLock() {
  const level = await LocalAuthentication.getEnrolledLevelAsync()
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    showAlert('无法开启', '请先在手机的系统设置里设置锁屏密码、指纹或面容')
    return false
  }
  if (!(await authenticate())) return false
  useSettings.getState().setLock(true)
  return true
}
