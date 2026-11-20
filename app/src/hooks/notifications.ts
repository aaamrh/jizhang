import * as Notifications from 'expo-notifications'
import { AppState, Platform } from 'react-native'
import { db, subscribeDb } from '../db/client'
import { isDayCounted } from '../db/dayRepo'
import { useSettings } from '../store/settingsStore'
import { addDays, fromDateStr, today } from '../utils/dates'

const CHANNEL = 'reminder'
// 记账提醒按“具体日期”排未来 30 天：今天已经记过账就跳过今天。
// shortcut: 连续 30 天不打开 App 就不再提醒；每次打开、记账都会重新排，iOS 最多 64 条待发通知，30 条够用
const DAYS_AHEAD = 30
export const WEEKLY_SCREEN = 'WeeklyReport' // 只是通知里的记号（周账页已并进盘账），已经排好的通知带的是这个值，别改

let lastSig = ''
let queue: Promise<void> = Promise.resolve()

function plan() {
  const s = useSettings.getState()
  const day = today()
  const counted = isDayCounted(db, day)
  return { s, day, counted, sig: [day, counted, s.reminderEnabled, s.reminderTime, s.weeklyEnabled].join('|') }
}

async function apply({ s, day, counted }: ReturnType<typeof plan>) {
  await Notifications.cancelAllScheduledNotificationsAsync()
  if (!s.reminderEnabled && !s.weeklyEnabled) return
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: '记账提醒', importance: Notifications.AndroidImportance.DEFAULT })
  }
  if (s.reminderEnabled) {
    const [h, m] = s.reminderTime.split(':').map(Number)
    for (let i = counted ? 1 : 0; i < DAYS_AHEAD; i++) {
      const at = fromDateStr(addDays(day, i))
      at.setHours(h ?? 21, m ?? 0, 0, 0)
      if (at.getTime() <= Date.now()) continue
      await Notifications.scheduleNotificationAsync({
        content: { title: '账房', body: '今天的账记了吗？花一分钟记下来吧。' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      })
    }
  }
  if (s.weeklyEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: { title: '账房', body: '本周的账出来了，看看这周的钱花在了哪里。', data: { screen: WEEKLY_SCREEN } },
      // weekday 1 = 周日
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 20, minute: 0, channelId: CHANNEL },
    })
  }
}

/** 按当前设置和“今天记没记”重排通知；状态没变就什么都不做 */
export function syncNotifications() {
  const p = plan()
  if (p.sig === lastSig) return queue
  lastSig = p.sig
  queue = queue
    .then(() => apply(p))
    .catch(() => {
      lastSig = '' // 下次再试
    })
  return queue
}

/** App 启动后调用一次：数据库变化（防抖）、回到前台、设置变化时自动重排 */
export function startNotificationSync() {
  let timer: ReturnType<typeof setTimeout> | null = null
  const later = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void syncNotifications(), 500)
  }
  const offDb = subscribeDb(later)
  const offApp = AppState.addEventListener('change', (st) => st === 'active' && later())
  const offSettings = useSettings.subscribe(later)
  void syncNotifications()
  return () => {
    offDb()
    offApp.remove()
    offSettings()
    if (timer) clearTimeout(timer)
  }
}
