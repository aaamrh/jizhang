import { ExtensionStorage } from '@bacons/apple-targets'
import { AppState, Platform } from 'react-native'
import { requestWidgetUpdate } from 'react-native-android-widget'
import { subscribeDb } from '../db/client'
import { readSnapshot } from './snapshot'
import { ANDROID_WIDGET_NAME, SpendWidget } from './SpendWidget'

/** 必须和 app.json 的 ios.entitlements、targets/widget 里的 App Group 一致 */
export const APP_GROUP = 'group.com.zhangfang.app'

let lastSig = ''

/** 数字有变化才刷新小组件：安卓重新渲染，iOS 写进 App Group 后让 WidgetKit 重载 */
export function syncWidgets() {
  const snap = readSnapshot()
  const sig = `${snap.day}|${snap.todayCents}|${snap.monthCents}`
  if (sig === lastSig) return
  lastSig = sig
  try {
    if (Platform.OS === 'android') {
      requestWidgetUpdate({ widgetName: ANDROID_WIDGET_NAME, renderWidget: () => <SpendWidget {...snap} /> }).catch(() => {
        lastSig = ''
      })
    } else if (Platform.OS === 'ios') {
      const storage = new ExtensionStorage(APP_GROUP)
      storage.set('day', snap.day)
      storage.set('todayCents', snap.todayCents)
      storage.set('monthCents', snap.monthCents)
      ExtensionStorage.reloadWidget()
    }
  } catch {
    lastSig = '' // 开发环境（Expo Go）没有原生模块：忽略
  }
}

/** App 启动后调用一次：记账后（防抖）、回到前台时刷新 */
export function startWidgetSync() {
  let timer: ReturnType<typeof setTimeout> | null = null
  const later = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(syncWidgets, 800)
  }
  const offDb = subscribeDb(later)
  const offApp = AppState.addEventListener('change', (st) => st === 'active' && later())
  syncWidgets()
  return () => {
    offDb()
    offApp.remove()
    if (timer) clearTimeout(timer)
  }
}
