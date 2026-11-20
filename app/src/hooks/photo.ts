import { Directory, File, Paths } from 'expo-file-system'
import { showAlert } from '../components/dialogs'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useState } from 'react'
import { authHeaders } from '../api/client'
import { deleteFile, fileUrl, uploadPhoto } from '../api/fileApi'
import { db } from '../db/client'
import { markUploaded, pendingUploads, setCached, type PhotoTable } from '../db/photoRepo'
import { useAuth } from '../store/authStore'
import { photoState, photoUriOf, type PhotoFields, type PhotoState } from '../utils/photoState'
import { setAssetPhoto } from '../db/assetRepo'
import { setTxnPhoto } from '../db/txnRepo'

// 家当、圆梦、账目小票照片：先压缩存本机（离线也能立刻看到），登录且同意同步后在后台上传；
// 别的手机拿到云端 id 后按需下载并缓存。云端存储见 api/src/integrations/storage.ts

const MAX_EDGE = 1280
const dir = (name: string) => {
  const d = new Directory(Paths.document, name)
  if (!d.exists) d.create({ intermediates: true })
  return d
}

/** 登录且同意同步时，照片才上云 */
const canSync = () => {
  const a = useAuth.getState()
  return !!a.token && !!a.syncConsent
}

async function pick(source: 'camera' | 'library') {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) {
    showAlert('需要权限', source === 'camera' ? '请在系统设置里允许账房使用相机' : '请在系统设置里允许账房访问相册')
    return null
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false }
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts)
  if (r.canceled || !r.assets[0]) return null
  return r.assets[0]
}

/** 压缩成长边约 1280 的 JPEG，存到本机，返回文件 uri */
async function store(img: ImagePicker.ImagePickerAsset, name: string) {
  const ctx = ImageManipulator.manipulate(img.uri)
  if (Math.max(img.width, img.height) > MAX_EDGE) ctx.resize(img.width >= img.height ? { width: MAX_EDGE } : { height: MAX_EDGE })
  const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG })
  const target = new File(dir('asset-photos'), `${name}-${Date.now()}.jpg`)
  new File(out.uri).move(target)
  return target.uri
}

function removeFile(uri: string | null | undefined) {
  if (!uri) return
  try {
    const f = new File(uri)
    if (f.exists) f.delete()
  } catch {
    // 文件已经不在了，无所谓
  }
}

/** 云端旧照片顺手删掉；没网、没权限（家庭账本里别人传的）都无所谓，不影响本机 */
function dropRemote(fileId: string | null) {
  if (fileId && canSync()) void deleteFile(fileId).catch(() => {})
}

/** 拍照或从相册选一张，作为家当的封面；替换掉旧照片 */
export async function choosePhoto(assetId: string, old: string | null, source: 'camera' | 'library') {
  const img = await pick(source)
  if (!img) return
  try {
    const uri = await store(img, assetId)
    dropRemote(setAssetPhoto(db, assetId, uri))
    removeFile(old)
    void uploadPendingPhotos()
  } catch (e) {
    showAlert('照片没存上', e instanceof Error ? e.message : String(e))
  }
}

export function removePhoto(assetId: string, old: string | null) {
  dropRemote(setAssetPhoto(db, assetId, null))
  removeFile(old)
}

// ───────── 圆梦照片：选好先存本机，圆梦时写进目标，之后同家当照片一样上传 ─────────

/** 拍照或从相册选一张，压缩后保存，返回本机路径；取消返回 null */
export async function pickPhoto(name: string, source: 'camera' | 'library'): Promise<string | null> {
  const img = await pick(source)
  if (!img) return null
  try {
    return await store(img, name)
  } catch (e) {
    showAlert('照片没存上', e instanceof Error ? e.message : String(e))
    return null
  }
}

/** 选了没保存就离开时，删掉本机文件 */
export const discardPhoto = (uri: string | null) => removeFile(uri)

// ───────── 账目小票照片：记一笔时先选好（pickPhoto 存本机），保存时写进账目 ─────────

/** 保存账目时换照片（null = 去掉）；旧的本机文件、云端文件顺手删掉 */
export function saveTxnPhoto(txnId: string, uri: string | null, oldLocal: string | null) {
  dropRemote(setTxnPhoto(db, txnId, uri))
  if (oldLocal && oldLocal !== uri) removeFile(oldLocal)
  void uploadPendingPhotos()
}

/** 账目删掉了：本机照片和云端照片一起删（删除不能恢复） */
export function forgetPhoto(local: string | null, fileId: string | null) {
  dropRemote(fileId)
  removeFile(local)
}

// ───────── 上传队列 ─────────

let uploading: Promise<void> | null = null

/** 把等上传的照片传上去（同步之后、换照片之后调用）；同一时间只跑一轮，失败的下次再试 */
export function uploadPendingPhotos(): Promise<void> {
  if (!canSync()) return Promise.resolve()
  if (uploading) return uploading
  uploading = (async () => {
    for (const p of pendingUploads(db)) {
      if (!new File(p.photo).exists) continue // 本机文件丢了（被系统清理），只能等用户重新选
      try {
        const fileId = await uploadPhoto(p.ledgerId, p.photo)
        markUploaded(db, p.table, p.id, p.photo, fileId) // 标记 dirty → 自动同步给别的手机
      } catch {
        break // 网络不好就先停，下次同步再传
      }
    }
  })().finally(() => {
    uploading = null
  })
  return uploading
}

// ───────── 下载缓存 ─────────

const downloading = new Map<string, Promise<void>>()

function download(table: PhotoTable, id: string, fileId: string, stale: string | null) {
  if (!downloading.has(fileId)) {
    const job = (async () => {
      const target = new File(dir('photo-cache'), `${fileId}.jpg`)
      if (!target.exists) await File.downloadFileAsync(fileUrl(fileId), target, { headers: authHeaders(), idempotent: true })
      setCached(db, table, id, fileId, target.uri)
      if (stale && stale !== target.uri) removeFile(stale)
    })()
      .catch(() => {}) // 没网或没权限：保持占位，下次打开再试
      .finally(() => downloading.delete(fileId))
    downloading.set(fileId, job)
  }
  return downloading.get(fileId)!
}

/**
 * 页面里显示照片用：返回当前状态和可显示的地址；需要时自动从云端下载。
 * 状态：none 没照片 / local 只在本机 / pending 等上传 / synced 已同步 / download 下载中
 */
export function usePhoto(table: PhotoTable, id: string, p: PhotoFields): { state: PhotoState; uri: string | null } {
  const token = useAuth((s) => s.token)
  const consent = useAuth((s) => s.syncConsent)
  const state = photoState(p, !!token && !!consent)
  const [, bump] = useState(0)
  useEffect(() => {
    if (state.kind === 'download' && token) void download(table, id, state.fileId, state.stale).then(() => bump((n) => n + 1))
  }, [state.kind === 'download' ? state.fileId : null, token, table, id])
  return { state, uri: photoUriOf(state) }
}

/** 照片状态的一句话说明（家当详情、圆梦页） */
export const photoNote = (s: PhotoState, loggedIn: boolean) =>
  s.kind === 'pending'
    ? '照片稍后上传，同步到你的账号'
    : s.kind === 'download'
      ? '照片下载中…'
      : s.kind === 'synced'
        ? '照片已同步到你的账号'
        : loggedIn
          ? '开启同步后，照片会跟账目一起同步'
          : '照片只存在这台手机上，登录后可同步'
