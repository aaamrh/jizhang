// 照片上传、下载、删除。接口见 docs/api.md「照片」
import { ApiError, apiUrl, authHeaders, request } from './client'

const UPLOAD_TIMEOUT_MS = 60_000

/** 上传一张本机照片到某个账本，返回云端文件 id */
export async function uploadPhoto(ledgerId: string, localUri: string): Promise<string> {
  const form = new FormData()
  form.append('ledgerId', ledgerId) // 字段顺序有要求：先 ledgerId 再文件
  form.append('file', { uri: localUri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS)
  try {
    const res = await fetch(apiUrl('/api/files'), { method: 'POST', headers: authHeaders(), body: form, signal: ctrl.signal })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'http_error', data.message ?? '照片上传失败')
    return data.id as string
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(0, 'network', '网络不太好，照片稍后再传')
  } finally {
    clearTimeout(timer)
  }
}

export const fileUrl = (fileId: string) => apiUrl(`/api/files/${fileId}`)

export const deleteFile = (fileId: string) => request<void>(`/api/files/${fileId}`, { method: 'DELETE' })
