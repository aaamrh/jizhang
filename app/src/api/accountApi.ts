import type { Credential, Product, Order, PayChannel, Provider, Session, SyncRequest, SyncResponse, User } from '../types/api'
import { request } from './client'

// ── 登录 ──
const LOGIN_PATH: Record<Credential['provider'], string> = {
  wechat: '/api/auth/wechat',
  sms: '/api/auth/sms/login',
  onekey: '/api/auth/onekey',
  apple: '/api/auth/apple',
}
const bodyOf = ({ provider: _, ...rest }: Credential) => rest

/** 正式环境返回空；测试环境服务器会把验证码放在 devCode 里（没接短信服务时也能登录） */
export const sendSmsCode = (phone: string) =>
  request<{ devCode?: string } | undefined>('/api/auth/sms/send', { method: 'POST', body: { phone } })
export const login = (c: Credential) => request<Session>(LOGIN_PATH[c.provider], { method: 'POST', body: bodyOf(c) })

// ── 账号 ──
export const getMe = () => request<User>('/api/me')
export const rename = (nickname: string) => request<User>('/api/me', { method: 'PATCH', body: { nickname } })
export const deleteAccount = () => request<void>('/api/me', { method: 'DELETE' })
/** 绑定手机号用短信验证码或一键登录 token */
export const bind = (provider: Provider, c: Credential) => request<User>(`/api/me/bind/${provider}`, { method: 'POST', body: bodyOf(c) })
export const unbind = (provider: Provider) => request<User>(`/api/me/bind/${provider}`, { method: 'DELETE' })

// ── 同步 ──
export const sync = (body: SyncRequest) => request<SyncResponse>('/api/sync', { method: 'POST', body })

// ── 会员 ──
export const products = (platform: 'ios' | 'android') => request<Product[]>(`/api/vip/products?platform=${platform}`)
export const createOrder = (productId: string, channel: PayChannel) =>
  request<{ orderId: string; amountCents: number; status: Order['status'] }>('/api/orders', { method: 'POST', body: { productId, channel } })
export const getOrder = (id: string) => request<Order>(`/api/orders/${id}`)
export const mockPay = (id: string) => request<Order>(`/api/orders/${id}/mock-pay`, { method: 'POST' })
