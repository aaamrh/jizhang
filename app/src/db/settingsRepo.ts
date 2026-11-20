import { eq } from 'drizzle-orm'
import { now, type DB } from './core'
import { settings } from './schema'

export type SettingKey =
  | 'deviceId'
  | 'privacyAgreed' // 首次启动同意了用户协议和隐私政策：协议版本号（协议大改时加一，重新征求同意）
  | 'pendingErrors' // 还没上报的出错信息（JSON 数组，最多 10 条）
  | 'firstLaunchAt'
  | 'lastExportAt'
  | 'syncNudgeAt'
  | 'reminderEnabled'
  | 'reminderTime'
  | 'lockEnabled'
  | 'dismissedVersion'
  | 'currentLedgerId'
  | 'familyView' // 首页在看的家庭账本 id；'' 看我的账本；旧版 '1'
  | 'reminderAsked' // 首次打开时问过“几点记账”
  | 'weeklyEnabled'
  | 'elderMode'
  | 'syncConsent' // 同意把账目上传同步：'1' 同意，'0' 拒绝（只在本机记）
  | 'pendingOrder' // 已下单还没确认到账的订单 id，回到前台时再查一次
  | 'entriesSaved' // 已记账笔数（用于第 3 笔后提示长按「记」）
  | 'tipQuickShown' // 已提示过长按「记」快速记常记
  | 'streakCelebrated' // 已经庆祝过的连续记账关口：'<日期>:<天数>'，同一个关口只弹一次
  | `budgetAlert:${string}` // 'budgetAlert:<账本>:<月份>:<分类或 total>' → 已提醒到的档位（80 / 100）

export function getSettings(db: DB): Partial<Record<SettingKey, string>> {
  return Object.fromEntries(db.select().from(settings).all().map((r) => [r.key, r.value]))
}

export function setSetting(db: DB, key: SettingKey, value: string) {
  db.insert(settings)
    .values({ key, value, updatedAt: now() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now() } })
    .run()
}

export function getSetting(db: DB, key: SettingKey) {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value
}
