import { create } from 'zustand'
import type { VersionInfo } from '../types/api'

import type { StreakMilestone } from '../utils/streak'
import type { PerkKey } from '../utils/vipPerks'

interface UiState {
  locked: boolean
  update: VersionInfo | null
  toast: string | null
  /** 诗句提示（攒钱目标）：古诗 + 白话 + 出处，显示约 4 秒 */
  verse: { verse: string; author: string; plain: string } | null
  /** 轻提示上的操作（如“撤销”）；有操作时显示 5 秒 */
  toastAction: { label: string; onPress: () => void } | null
  /** 记完一笔盖一枚“入账”章：每次加 1 触发动画 */
  stamp: number
  /** 底部操作菜单（长按账目、常记等）；安卓系统弹窗最多 3 个按钮，所以自己画 */
  actions: ActionMenu | null
  /** 弹窗（确认、提示）：自己画的，不用系统弹窗；见 components/dialogs 的 showAlert、confirm */
  dialog: Dialog | null
  /** 攒钱目标：reached 刚攒够（弹出牌匾）；withdrawn 攒够后从储钱罐取钱（问一句是不是去圆梦） */
  celebrate: { goalId: string; mode: 'reached' | 'withdrawn' } | null
  /** 连续记账跨过关口（7、21、30、100、365 天）时的庆祝卡片 */
  streakMoment: StreakMilestone | null
  /** 开通提醒抽屉：点了哪个会员功能就停在哪一项；null = 关着 */
  vipSheet: PerkKey | null
  showVipSheet: (k: PerkKey) => void
  hideVipSheet: () => void
  showStreakMoment: (m: StreakMilestone) => void
  hideStreakMoment: () => void
  setCelebrate: (v: { goalId: string; mode: 'reached' | 'withdrawn' } | null) => void
  setLocked: (v: boolean) => void
  setUpdate: (v: VersionInfo | null) => void
  showToast: (msg: string, action?: { label: string; onPress: () => void }) => void
  showVerse: (v: { verse: string; author: string; plain: string }) => void
  hideToast: () => void
  showStamp: () => void
  showActions: (menu: ActionMenu) => void
  hideActions: () => void
  showDialog: (d: Dialog) => void
  hideDialog: () => void
}

/** 按钮写法同系统的 Alert.alert：cancel 是“取消”（点遮罩、按返回也算它），destructive 是删除这类危险操作 */
export interface DialogButton {
  text: string
  style?: 'default' | 'cancel' | 'destructive'
  onPress?: () => void
  /** 按住才生效：回不去的操作（注销账号、解散家庭账本、覆盖导入） */
  hold?: boolean
}
export interface Dialog {
  title: string
  message?: string
  buttons: DialogButton[]
}

export interface ActionItem {
  label: string
  onPress: () => void
  danger?: boolean
}
export interface ActionMenu {
  title?: string
  items: ActionItem[]
}

/** 只在内存里的全局界面状态：应用锁、版本更新弹窗、轻提示 */
export const useUi = create<UiState>((set) => ({
  locked: false,
  update: null,
  toast: null,
  verse: null,
  toastAction: null,
  stamp: 0,
  actions: null,
  dialog: null,
  celebrate: null,
  setCelebrate: (celebrate) => set({ celebrate }),
  streakMoment: null,
  vipSheet: null,
  showVipSheet: (vipSheet) => set({ vipSheet }),
  hideVipSheet: () => set({ vipSheet: null }),
  showStreakMoment: (streakMoment) => set({ streakMoment }),
  hideStreakMoment: () => set({ streakMoment: null }),
  setLocked: (locked) => set({ locked }),
  setUpdate: (update) => set({ update }),
  showToast: (toast, action) => set({ toast, toastAction: action ?? null, verse: null }),
  showVerse: (verse) => set({ verse, toast: null, toastAction: null }),
  hideToast: () => set({ toast: null, toastAction: null, verse: null }),
  showStamp: () => set((s) => ({ stamp: s.stamp + 1 })),
  showActions: (actions) => set({ actions }),
  hideActions: () => set({ actions: null }),
  showDialog: (dialog) => set({ dialog }),
  hideDialog: () => set({ dialog: null }),
}))
