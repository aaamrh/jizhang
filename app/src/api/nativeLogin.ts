// 第三方登录的原生 SDK 都在这里，延迟加载：Expo Go 或没配置时不崩，只是不可用
import { Platform } from 'react-native'
import { ApiError } from './client'

const fail = (message: string) => new ApiError(0, 'native_login', message)

// ── 微信（expo-wechat）──
type WechatModule = typeof import('expo-wechat').default
let wx: WechatModule | null | undefined
function wechat(): WechatModule | null {
  if (wx === undefined) {
    try {
      wx = require('expo-wechat').default as WechatModule
    } catch {
      wx = null // Expo Go 里没有这个原生模块
    }
  }
  return wx
}
const WECHAT_APP_ID = process.env.EXPO_PUBLIC_WECHAT_APP_ID
const WECHAT_LINK = process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK ?? ''

export const wechatAvailable = () => !!WECHAT_APP_ID && !!wechat()

/** 拉起微信授权，返回 code（交给服务器换用户标识） */
export async function wechatAuthCode(): Promise<string> {
  const m = wechat()
  if (!m || !WECHAT_APP_ID) throw fail('当前环境不支持微信登录，请用手机号登录')
  if (!m.isRegistered && !(await m.registerApp(WECHAT_APP_ID, WECHAT_LINK))) throw fail('微信初始化失败')
  if (!(await m.isWXAppInstalled())) throw fail('手机上没有安装微信')
  const state = `zf${Date.now()}`
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => done(fail('微信没有返回结果，请重试')), 120_000)
    const sub = m.addListener('onAuthResult', (r) => {
      if (r.state !== state) return
      if (r.errorCode === 0 && r.code) done(null, r.code)
      else done(fail(r.errorCode === -2 ? '已取消微信登录' : '微信授权失败，请重试'))
    })
    function done(err: Error | null, code?: string) {
      clearTimeout(timer)
      sub.remove()
      if (err) reject(err)
      else resolve(code!)
    }
    m.sendAuthRequest('snsapi_userinfo', state)
      .then((sent) => !sent && done(fail('没能打开微信')))
      .catch(() => done(fail('没能打开微信')))
  })
}

// ── Sign in with Apple（expo-apple-authentication，只在 iOS）──
type AppleModule = typeof import('expo-apple-authentication')
const appleModule = (): AppleModule | null => {
  if (Platform.OS !== 'ios') return null
  try {
    return require('expo-apple-authentication') as AppleModule
  } catch {
    return null
  }
}

export async function appleAvailable() {
  try {
    return (await appleModule()?.isAvailableAsync()) ?? false
  } catch {
    return false
  }
}

export async function appleCredential(): Promise<{ identityToken: string; nickname?: string }> {
  const A = appleModule()
  if (!A) throw fail('当前设备不支持 Apple 登录')
  try {
    const c = await A.signInAsync({ requestedScopes: [A.AppleAuthenticationScope.FULL_NAME] })
    if (!c.identityToken) throw fail('Apple 登录失败，请重试')
    const name = [c.fullName?.familyName, c.fullName?.givenName].filter(Boolean).join('')
    return { identityToken: c.identityToken, nickname: name || undefined }
  } catch (e: any) {
    if (e instanceof ApiError) throw e
    throw fail(e?.code === 'ERR_REQUEST_CANCELED' ? '已取消 Apple 登录' : 'Apple 登录失败，请重试')
  }
}

// ── 本机号码一键登录 ──
// shortcut: 还没有接入运营商 SDK（需要公司开通阿里云号码认证并选定 SDK）。接入后在这里返回 SDK 拿到的 token。
export const onekeyAvailable = () => false
export async function onekeyToken(): Promise<string> {
  throw fail('本机号码一键登录暂未开通')
}
