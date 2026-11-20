// 登录、账号、会员：调接口 + 处理本机数据
import { Platform } from 'react-native'
import { showAlert } from '../components/dialogs'
import * as accountApi from '../api/accountApi'
import { ApiError } from '../api/client'
import * as ledgerApi from '../api/ledgerApi'
import { appleAvailable, appleCredential, onekeyAvailable, wechatAuthCode, wechatAvailable } from '../api/nativeLogin'
import { db } from '../db/client'
import { personalLedger } from '../db/ledgerRepo'
import { getSetting, setSetting } from '../db/settingsRepo'
import { bindPersonalLedger, resetForLogout } from '../db/sync'
import { useAuth } from '../store/authStore'
import { useSettings } from '../store/settingsStore'
import type { Credential, Provider, Session } from '../types/api'
import { fixCurrentLedger, syncNow } from './sync'
import { useUi } from '../store/uiStore'

const MOCK_PAY = process.env.EXPO_PUBLIC_MOCK_PAY === 'true'

/** 登录页显示哪些方式 */
export { appleAvailable, onekeyAvailable, wechatAvailable }

/** 把可能抛出接口错误的操作包起来：失败弹出服务器给的中文提示，成功返回结果 */
export async function attemptApi<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (e) {
    showAlert('提示', e instanceof ApiError ? e.message : '操作没有成功，请稍后再试')
    if (!(e instanceof ApiError)) console.error(e)
    return undefined
  }
}

const ask = (title: string, message: string, buttons: { text: string; value: string; style?: 'cancel' | 'destructive' }[]) =>
  new Promise<string>((resolve) =>
    showAlert(title, message, buttons.map((b) => ({ text: b.text, style: b.style, onPress: () => resolve(b.value) }))),
  )

/** 开启同步前单独征得同意（账目属于敏感个人信息） */
export async function askSyncConsent() {
  const v = await ask(
    '开启云同步？',
    '开启后，你的账目（每笔账和上面的照片、标签，钱袋、分类、家当、预算、常记、定时记账、心愿）会加密传输并保存在账房国内的服务器上，用于换手机恢复和家庭账本共享。后台看不到账目内容，注销账号就删除。\n不开启也能正常记账，账目只留在这台手机上，以后可以在「掌柜 → 账号与同步」里打开。',
    [
      { text: '暂不开启', value: 'no', style: 'cancel' },
      { text: '同意并开启', value: 'yes' },
    ],
  )
  useAuth.getState().setSyncConsent(v === 'yes')
  if (v !== 'yes') useSettings.getState().snoozeSyncNudge() // 刚说了不开，首页那句提醒 30 天内别再提
  return v === 'yes'
}

const chooseMerge = () =>
  ask('云端已经有你的账本', '这台手机上也记过账。要怎么处理？', [
    { text: '合并两边的账', value: 'merge' },
    { text: '用云端的覆盖本机', value: 'overwrite', style: 'destructive' },
  ]) as Promise<'merge' | 'overwrite'>

/** 本机个人账本和账号对上，然后同步。需要已登录且同意同步 */
export async function enableSync() {
  const local = personalLedger(db)
  if (!local) return
  const wasCurrent = useSettings.getState().currentLedgerId === local.id
  const id = await bindPersonalLedger(db, local.id, {
    listRemote: ledgerApi.listLedgers,
    createRemote: ledgerApi.createLedger,
    choose: chooseMerge,
    isIdTaken: (e) => e instanceof ApiError && e.code === 'conflict',
  })
  if (wasCurrent) useSettings.getState().setLedger(id)
  fixCurrentLedger()
  await syncNow()
}

/** 登录成功后：保存登录状态 → 问是否同步 → 对上个人账本 */
async function afterLogin(s: Session) {
  await useAuth.getState().setSession(s.token, s.user)
  const consent = useAuth.getState().syncConsent ?? (await askSyncConsent())
  if (consent) await enableSync()
}

/** 各种方式登录；成功返回 true */
export async function loginWith(kind: 'wechat' | 'apple' | 'sms', sms?: { phone: string; code: string }) {
  const r = await attemptApi(async () => {
    const cred: Credential =
      kind === 'wechat'
        ? { provider: 'wechat', code: await wechatAuthCode() }
        : kind === 'apple'
          ? { provider: 'apple', ...(await appleCredential()) }
          : { provider: 'sms', ...sms! }
    await afterLogin(await accountApi.login(cred))
    return true
  })
  return !!r
}

/** 发验证码。测试环境服务器回传验证码：提示出来，并返回给表单自动填上 */
export const sendSms = (phone: string) =>
  attemptApi(async () => {
    const r = await accountApi.sendSmsCode(phone)
    if (r?.devCode) useUi.getState().showToast(`测试环境验证码：${r.devCode}`)
    return { devCode: r?.devCode }
  })

export async function refreshMe() {
  const u = await accountApi.getMe()
  useAuth.getState().setUser(u)
  return u
}

export const accountActions = {
  rename: (nickname: string) => attemptApi(async () => useAuth.getState().setUser(await accountApi.rename(nickname))),
  /** 绑定：微信、Apple 走原生授权；手机号用短信验证码 */
  bind: (provider: Provider, sms?: { phone: string; code: string }) =>
    attemptApi(async () => {
      const cred: Credential =
        provider === 'wechat'
          ? { provider: 'wechat', code: await wechatAuthCode() }
          : provider === 'apple'
            ? { provider: 'apple', ...(await appleCredential()) }
            : { provider: 'sms', ...sms! }
      useAuth.getState().setUser(await accountApi.bind(provider, cred))
    }),
  unbind: (provider: Provider) => attemptApi(async () => useAuth.getState().setUser(await accountApi.unbind(provider))),

  /** 退出登录：先尽量把没传的改动传上去；家庭账本从本机删除，个人账本保留 */
  logout: async () => {
    await syncNow().catch(() => {})
    resetForLogout(db)
    await useAuth.getState().clear()
    fixCurrentLedger()
  },

  /** 注销账号：服务器上的数据全部删除；本机个人账本保留 */
  deleteAccount: () =>
    attemptApi(async () => {
      await accountApi.deleteAccount()
      resetForLogout(db)
      await useAuth.getState().clear()
      fixCurrentLedger()
      return true
    }),

  /** 开启云同步：先弹同样的说明征得同意（asked：按钮本身就写着“同意云同步”，不再弹） */
  turnOnSync: async (asked = false) => {
    if (asked) useAuth.getState().setSyncConsent(true)
    else if (!(await askSyncConsent())) return
    await attemptApi(enableSync)
  },
}

// ── 会员 ──

/** 付费方案：价格已按当前活动和新人价算好（登录后才有新人价） */
export const loadProducts = () => accountApi.products(Platform.OS === 'ios' ? 'ios' : 'android')

/** 购买：测试环境走模拟支付；真实渠道没接入时显示服务器的提示（支付暂未开通） */
export const buyVip = (productId: string) =>
  attemptApi(async () => {
    const channel = MOCK_PAY ? 'mock' : Platform.OS === 'ios' ? 'apple' : 'wechat'
    const o = await accountApi.createOrder(productId, channel)
    setSetting(db, 'pendingOrder', o.orderId)
    // shortcut: 真实渠道接入后，在这里拉起微信支付 / 支付宝 / 苹果内购，结果以服务器订单状态为准
    if (channel === 'mock') await accountApi.mockPay(o.orderId)
    await checkPendingOrder()
    return true
  })

/** 回到前台时调用：有待确认的订单就查一次，到账了刷新会员状态 */
export async function checkPendingOrder() {
  const id = getSetting(db, 'pendingOrder')
  if (!id || !useAuth.getState().token) return
  try {
    const o = await accountApi.getOrder(id)
    if (o.status === 'pending') return
    setSetting(db, 'pendingOrder', '')
    if (o.status === 'paid') await refreshMe()
  } catch {
    // 没网：下次再查
  }
}
