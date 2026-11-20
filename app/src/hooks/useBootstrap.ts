import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { checkVersion, pingDevice } from '../api/appApi'
import { db, useDbMigrations } from '../db/client'
import { migrateLegacyIcons } from '../db/categoryRepo'
import { migrateLegacyReviews } from '../db/txnRepo'
import { ensurePersonalLedger, getLedger } from '../db/ledgerRepo'
import { useAuth } from '../store/authStore'
import { useSettings } from '../store/settingsStore'
import { useUi } from '../store/uiStore'
import { appVersion } from './appVersion'
import { flushErrors } from './errorReport'

export { appVersion } from './appVersion'

/** 启动：建表/升级 → 确保有个人账本 → 读设置 → 应用锁 → 后台上报与版本检查 */
export function useBootstrap() {
  const { success, error } = useDbMigrations()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!success) return
    const personal = ensurePersonalLedger(db)
    migrateLegacyIcons(db) // 旧版本的 Lucide 分类图标 → 复古图标
    migrateLegacyReviews(db) // 旧版本的 值/一般/悔/跳过 → 必要/非必要/没复盘
    const settings = useSettings.getState()
    settings.hydrate(personal)
    // 本机数据只用“我的账本”。以前停在家庭账本 → 改成“在看家庭账本”；停在已取消的专项账本或已经不在的账本 → 回到我的账本
    const cur = getLedger(db, useSettings.getState().currentLedgerId)
    if (cur?.type !== 'personal') {
      settings.setLedger(personal)
      if (cur?.type === 'family') settings.setFamilyView(cur.id)
    }
    if (useSettings.getState().lockEnabled) useUi.getState().setLocked(true)
    // 先读出登录状态（token 在安全存储里，异步），再上报：登录后上报带上用户
    useAuth
      .getState()
      .hydrate()
      .catch(() => {})
      .finally(() => {
        setReady(true)
        // 同意隐私政策之前不上报任何东西；同意时由同意页调用 phoneHome
        if (useSettings.getState().privacyAgreed) void phoneHome()
      })
  }, [success])

  return { ready, error }
}

/** 匿名上报 + 版本检查 + 发出攒下的出错信息，失败都不打扰用户（同意隐私政策后才调用） */
export async function phoneHome() {
  void flushErrors()
  const { deviceId, dismissedVersion } = useSettings.getState()
  const platform = Platform.OS === 'ios' ? 'ios' : 'android'
  const version = appVersion()
  pingDevice({ deviceId, platform, appVersion: version }).catch(() => {})
  try {
    const v = await checkVersion(platform, version)
    if (v.update === 'force' || (v.update === 'optional' && v.latest !== dismissedVersion)) useUi.getState().setUpdate(v)
  } catch {
    // 没网或服务器不可用：下次启动再查
  }
}
