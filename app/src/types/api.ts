// 与 docs/api.md 对应的接口类型

export interface PingBody {
  deviceId: string
  platform: 'ios' | 'android'
  appVersion: string
}

export interface VersionInfo {
  update: 'none' | 'optional' | 'force'
  latest: string | null
  notes: string
  downloadUrl: string | null
}

export type Provider = 'wechat' | 'phone' | 'apple'

export interface User {
  id: string
  nickname: string
  phone: string | null // 打码：138****0000
  providers: Provider[]
  vipUntil: string | null
  isVip: boolean
  createdAt: string
}

export interface Session {
  token: string
  user: User
  isNew: boolean
}

/** 各登录方式的请求体（绑定接口复用） */
export type Credential =
  | { provider: 'wechat'; code: string }
  | { provider: 'sms'; phone: string; code: string }
  | { provider: 'onekey'; token: string }
  | { provider: 'apple'; identityToken: string; nickname?: string }

export interface RemoteMember {
  id: string
  userId: string | null
  nickname: string
  role: 'admin' | 'member' | 'profile'
  elderMode: boolean
  isMe: boolean
  removed?: boolean // 已离开：只用来显示历史账目的名字
  isVip?: boolean // 大掌柜
  joinedAt: string
  shareFrom?: string // 这个人的账从哪天起汇进家庭账本（旧服务器没有）
}

export interface RemoteLedger {
  id: string
  name: string
  type: 'personal' | 'book' | 'family'
  cover?: string | null
  myRole: 'admin' | 'member'
  members: RemoteMember[]
  createdAt: string
}

export interface Invite {
  code: string
  url: string
  expiresAt: string
  profileMemberId: string | null
}

export interface InvitePreview {
  ledgerName: string
  cover?: string | null
  inviterNickname: string
  profileNickname: string | null
  memberCount: number
  expiresAt: string
}

export const ENTITIES = ['wallets', 'categories', 'transactions', 'assets', 'budgets', 'dayMarks', 'templates', 'goals', 'recurrings'] as const
export type Entity = (typeof ENTITIES)[number]

export interface SyncRecord {
  id: string
  ledgerId: string
  updatedAt: number
  deletedAt: number | null
  data: Record<string, unknown>
  version?: number
  updatedBy?: string | null
}

export interface SyncRequest {
  cursors: Record<string, number>
  changes: Partial<Record<Entity, SyncRecord[]>>
}

export interface SyncResponse {
  ledgers: RemoteLedger[]
  changes: Record<Entity, SyncRecord[]>
  cursors: Record<string, number>
  hasMore: boolean
  rejected: { entity: Entity; id: string; reason: 'forbidden' | 'conflict' | 'invalid' }[]
}

export interface Product {
  id: string
  name: string
  days: number
  priceCents: number
  originalPriceCents: number
  badge: string | null
  appleProductId: string | null
}

export type PayChannel = 'wechat' | 'alipay' | 'apple' | 'mock'

export interface Order {
  id: string
  productId: string
  channel: PayChannel
  amountCents: number
  status: 'pending' | 'paid' | 'closed' | 'refunded'
  paidAt: string | null
}
