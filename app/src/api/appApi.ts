import type { PingBody, VersionInfo } from '../types/api'
import { request } from './client'

/** 匿名上报：随机安装 id、平台、版本号；登录后 client 自动带上 token */
export const pingDevice = (body: PingBody) => request<void>('/api/devices/ping', { method: 'POST', body })

/** 出错上报（同意隐私政策后才发）：只有出错信息和代码位置 */
export const reportErrors = (body: {
  deviceId: string
  platform: 'ios' | 'android'
  appVersion: string
  reports: { message: string; stack: string; fatal: boolean; at: number }[]
}) => request<void>('/api/client-errors', { method: 'POST', body })

export const checkVersion = (platform: 'ios' | 'android', current: string) =>
  request<VersionInfo>(`/api/app/version?platform=${platform}&current=${encodeURIComponent(current)}`)
