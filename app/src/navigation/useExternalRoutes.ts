import * as Notifications from 'expo-notifications'
import { useEffect } from 'react'
import { Linking } from 'react-native'
import { REVIEW_SCREEN, WEEKLY_SCREEN } from '../hooks/notifications'
import { useSettings } from '../store/settingsStore'
import { monthOf, today } from '../utils/dates'
import { navigationRef, whenReady } from './ref'

/** 小组件的“记一笔”：zhangfang://add */
const ADD_URL = /^zhangfang:\/\/add\b/
/** 家庭邀请：zhangfang://invite/<8 位邀请码> */
const INVITE_URL = /^zhangfang:\/\/invite\/([A-Za-z0-9]{8})\b/

function openUrl(url: string | null | undefined) {
  if (!url) return
  const invite = INVITE_URL.exec(url)
  if (invite) return whenReady(() => navigationRef.navigate('Join', { code: invite[1]!.toUpperCase() }))
  if (!ADD_URL.test(url)) return
  whenReady(() => {
    if (useSettings.getState().elderMode) navigationRef.navigate('ElderEntry')
    else navigationRef.navigate('EntryEdit', {})
  })
}

function openNotification(r: Notifications.NotificationResponse | null) {
  const screen = r?.notification.request.content.data?.screen
  if (screen !== WEEKLY_SCREEN && screen !== REVIEW_SCREEN) return
  Notifications.clearLastNotificationResponse()
  if (screen === REVIEW_SCREEN) return whenReady(() => navigationRef.navigate('Review', { month: monthOf(today()) }))
  whenReady(() => navigationRef.navigate('Tabs', { screen: 'Stats', params: { week: today() } }))
}

/** 深链（桌面小组件、家庭邀请）和通知点击：打开对应页面。App 里只调用一次 */
export function useExternalRoutes() {
  useEffect(() => {
    Linking.getInitialURL().then(openUrl).catch(() => {})
    const link = Linking.addEventListener('url', (e) => openUrl(e.url))
    openNotification(Notifications.getLastNotificationResponse())
    const tap = Notifications.addNotificationResponseReceivedListener(openNotification)
    return () => {
      link.remove()
      tap.remove()
    }
  }, [])
}
