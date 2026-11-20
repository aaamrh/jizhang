// 接口约定见 docs/api.md
const TIMEOUT_MS = 10_000

let base = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000'
let token: string | null = null
let onUnauthorized: (() => void) | null = null

/** 测试里指向进程内启动的后端 */
export const setApiBase = (url: string) => {
  base = url.replace(/\/$/, '')
}
/** 登录状态由 store 管理，这里只保存当前 token，每个请求自动带上 */
export const setAuthToken = (t: string | null) => {
  token = t
}
/** 带 token 的请求返回 401（过期、注销、冻结）时调用，由 store 清掉登录状态 */
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn
}

/** 上传、下载文件这类不走 JSON 的请求要用到 */
export const apiUrl = (path: string) => `${base}${path}`
export const authHeaders = (): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {})

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const sentToken = token
  try {
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        // 没有请求体时不能带 json 类型，否则服务器按空 JSON 报错
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(sentToken ? { authorization: `Bearer ${sentToken}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
    })
    if (res.status === 204) return undefined as T
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (res.status === 401 && sentToken) onUnauthorized?.()
      throw new ApiError(res.status, data.error ?? 'http_error', data.message ?? '网络请求失败')
    }
    return data as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(0, 'network', '网络不太好，请稍后再试')
  } finally {
    clearTimeout(timer)
  }
}
