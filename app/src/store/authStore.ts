import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import { getMe } from '../api/accountApi'
import { setAuthToken, setUnauthorizedHandler } from '../api/client'
import { db } from '../db/client'
import { getSetting, setSetting } from '../db/settingsRepo'
import type { User } from '../types/api'

const TOKEN_KEY = 'zf_token'
const USER_KEY = 'zf_user' // 缓存用户信息：没网时也能显示登录状态

interface AuthState {
  token: string | null
  user: User | null
  /** 同意把账目上传同步（敏感个人信息，单独征得同意）；null = 还没问过 */
  syncConsent: boolean | null
  syncing: boolean
  lastSyncAt: number | null
  syncError: string | null

  hydrate: () => Promise<void>
  setSession: (token: string, user: User) => Promise<void>
  setUser: (user: User) => void
  /** 只清登录信息，本机数据由调用方处理 */
  clear: () => Promise<void>
  setSyncConsent: (v: boolean) => void
  setSyncStatus: (v: Partial<Pick<AuthState, 'syncing' | 'lastSyncAt' | 'syncError'>>) => void
}

/** 登录状态。token 存在系统安全存储里；接口请求由 api/client 自动带上 */
export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  syncConsent: null,
  syncing: false,
  lastSyncAt: null,
  syncError: null,

  hydrate: async () => {
    const consent = getSetting(db, 'syncConsent')
    set({ syncConsent: consent === undefined ? null : consent === '1' })
    // token 过期、账号被冻结或注销：只清登录信息，本机账目都保留
    setUnauthorizedHandler(() => void get().clear())
    const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null)
    if (!token) return
    const cached = await SecureStore.getItemAsync(USER_KEY).catch(() => null)
    setAuthToken(token)
    set({ token, user: cached ? (JSON.parse(cached) as User) : null })
    // 401 时 client 已调用上面的 clear；没网时沿用缓存的用户信息
    getMe()
      .then((u) => get().setUser(u))
      .catch(() => {})
  },

  setSession: async (token, user) => {
    setAuthToken(token)
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
    set({ token, user })
  },

  setUser: (user) => {
    void SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => {})
    set({ user })
  },

  clear: async () => {
    setAuthToken(null)
    set({ token: null, user: null, syncing: false, syncError: null })
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {})
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {})
  },

  setSyncConsent: (v) => {
    setSetting(db, 'syncConsent', v ? '1' : '0')
    set({ syncConsent: v })
  },

  setSyncStatus: (v) => set(v),
}))

/** 当前登录用户 id（记账人），未登录为 null */
export const currentUserId = () => useAuth.getState().user?.id ?? null
