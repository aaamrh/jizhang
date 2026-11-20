export interface WechatClient {
  /** 用 App 授权后拿到的 code 换取用户标识；失败抛错 */
  exchange(code: string): Promise<{ openid: string; unionid?: string }>
}

/** 未配置 AppID/AppSecret 时返回 null，由 biz 层报 not_configured */
export function createWechatClient(appId?: string, secret?: string, fetchFn: typeof fetch = fetch): WechatClient | null {
  if (!appId || !secret) return null
  return {
    async exchange(code) {
      const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token')
      url.search = new URLSearchParams({ appid: appId, secret, code, grant_type: 'authorization_code' }).toString()
      const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) })
      // 微信出错时也返回 200，错误在 body 的 errcode 里
      const body = (await res.json()) as { openid?: string; unionid?: string; errcode?: number; errmsg?: string }
      if (!body.openid) throw new Error(`wechat errcode=${body.errcode} ${body.errmsg ?? ''}`)
      return { openid: body.openid, unionid: body.unionid }
    },
  }
}
