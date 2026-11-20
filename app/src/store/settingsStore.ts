import * as Notifications from 'expo-notifications'
import { create } from 'zustand'
import { db } from '../db/client'
import { newId } from '../db/core'
import { getSettings, setSetting } from '../db/settingsRepo'
import { monthOf, today } from '../utils/dates'

interface SettingsState {
  // 持久化在本地 settings 表
  deviceId: string
  /** 同意过当前版本的用户协议和隐私政策；没同意前不上报任何东西 */
  privacyAgreed: boolean
  firstLaunchAt: number
  lastExportAt: number | null
  /** 首页“开启云同步”提醒上次被关掉的时间（30 天内不再提） */
  syncNudgeAt: number | null
  reminderEnabled: boolean
  reminderTime: string // 'HH:MM'
  reminderAsked: boolean
  weeklyEnabled: boolean
  lockEnabled: boolean
  elderMode: boolean
  dismissedVersion: string | null
  /** 本机数据（记账、钱袋、分类、预算……）用的账本，永远是“我的账本” */
  currentLedgerId: string
  /**
   * 首页、盘账正在看的家庭账本 id，'' = 看我的账本（家庭账本是一家人账的汇总，从服务器取；记账照样记在我的账本）。
   * 可以在好几个家庭里；旧版存的是 '1'（只有一个家庭），由 useViewedFamily 当作第一个家庭
   */
  familyView: string
  // 只在内存里
  month: string
  excludeAssets: boolean

  hydrate: (personalLedgerId: string) => void
  setMonth: (m: string) => void
  setExcludeAssets: (v: boolean) => void
  setLedger: (id: string) => void
  agreePrivacy: () => void
  setFamilyView: (ledgerId: string) => void
  setReminder: (enabled: boolean, time?: string) => Promise<boolean>
  markReminderAsked: () => void
  setWeekly: (enabled: boolean) => Promise<boolean>
  setLock: (enabled: boolean) => void
  /** 长辈模式的唯一开关；以后家庭账本管理员远程开启也调用这里 */
  setElderMode: (on: boolean) => void
  markExported: () => void
  snoozeSyncNudge: () => void
  dismissVersion: (v: string) => void
}

/** 用户协议、隐私政策的版本：有实质改动时加一，启动时重新请用户同意 */
export const PRIVACY_VERSION = '1'

const askPermission = async () => (await Notifications.requestPermissionsAsync()).granted

/**
 * 设置和界面状态。账目数据不放这里，由 hooks 直接从数据库读。
 * 通知的排期不在这里做：hooks/notifications 订阅这里的变化后重新排期。
 */
export const useSettings = create<SettingsState>((set, get) => ({
  deviceId: '',
  privacyAgreed: false,
  firstLaunchAt: Date.now(),
  lastExportAt: null,
  syncNudgeAt: null,
  reminderEnabled: false,
  reminderTime: '21:00',
  reminderAsked: false,
  weeklyEnabled: true,
  lockEnabled: false,
  elderMode: false,
  dismissedVersion: null,
  currentLedgerId: '',
  familyView: '',
  month: monthOf(today()),
  excludeAssets: false,

  hydrate: (personalLedgerId) => {
    const s = getSettings(db)
    const deviceId = s.deviceId ?? newId()
    const firstLaunchAt = s.firstLaunchAt ? Number(s.firstLaunchAt) : Date.now()
    if (!s.deviceId) setSetting(db, 'deviceId', deviceId)
    if (!s.firstLaunchAt) setSetting(db, 'firstLaunchAt', String(firstLaunchAt))
    set({
      deviceId,
      privacyAgreed: s.privacyAgreed === PRIVACY_VERSION,
      firstLaunchAt,
      lastExportAt: s.lastExportAt ? Number(s.lastExportAt) : null,
      syncNudgeAt: s.syncNudgeAt ? Number(s.syncNudgeAt) : null,
      reminderEnabled: s.reminderEnabled === '1',
      reminderTime: s.reminderTime ?? '21:00',
      // 老版本已经开过提醒的，不再问
      reminderAsked: s.reminderAsked === '1' || s.reminderEnabled === '1',
      weeklyEnabled: s.weeklyEnabled !== '0',
      lockEnabled: s.lockEnabled === '1',
      elderMode: s.elderMode === '1',
      dismissedVersion: s.dismissedVersion ?? null,
      currentLedgerId: s.currentLedgerId ?? personalLedgerId,
      familyView: s.familyView && s.familyView !== '0' ? s.familyView : '',
    })
  },

  setMonth: (month) => set({ month }),
  setExcludeAssets: (excludeAssets) => set({ excludeAssets }),

  agreePrivacy: () => {
    setSetting(db, 'privacyAgreed', PRIVACY_VERSION)
    set({ privacyAgreed: true })
  },

  setLedger: (id) => {
    setSetting(db, 'currentLedgerId', id)
    set({ currentLedgerId: id })
  },

  setFamilyView: (ledgerId) => {
    setSetting(db, 'familyView', ledgerId)
    set({ familyView: ledgerId })
  },

  /** 开关提醒或改时间；没有通知权限时返回 false */
  setReminder: async (enabled, time = get().reminderTime) => {
    if (enabled && !(await askPermission())) return false
    setSetting(db, 'reminderEnabled', enabled ? '1' : '0')
    setSetting(db, 'reminderTime', time)
    set({ reminderEnabled: enabled, reminderTime: time })
    get().markReminderAsked()
    return true
  },

  markReminderAsked: () => {
    setSetting(db, 'reminderAsked', '1')
    set({ reminderAsked: true })
  },

  setWeekly: async (enabled) => {
    if (enabled && !(await askPermission())) return false
    setSetting(db, 'weeklyEnabled', enabled ? '1' : '0')
    set({ weeklyEnabled: enabled })
    return true
  },

  setLock: (enabled) => {
    setSetting(db, 'lockEnabled', enabled ? '1' : '0')
    set({ lockEnabled: enabled })
  },

  setElderMode: (on) => {
    setSetting(db, 'elderMode', on ? '1' : '0')
    set({ elderMode: on })
  },

  markExported: () => {
    const t = Date.now()
    setSetting(db, 'lastExportAt', String(t))
    set({ lastExportAt: t })
  },

  snoozeSyncNudge: () => {
    const t = Date.now()
    setSetting(db, 'syncNudgeAt', String(t))
    set({ syncNudgeAt: t })
  },

  dismissVersion: (v) => {
    setSetting(db, 'dismissedVersion', v)
    set({ dismissedVersion: v })
  },
}))
