/**
 * 一张照片现在该怎么显示（纯函数，可测）。
 * - photoFileId：云端文件 id，随账目同步；photo：本机缓存路径；photoCachedFor：这份缓存对应的云端 id
 */
export type PhotoFields = { photo: string | null; photoFileId: string | null; photoCachedFor: string | null }

export type PhotoState =
  | { kind: 'none' } // 没有照片
  | { kind: 'local'; uri: string } // 只在本机（没登录或没开同步）
  | { kind: 'pending'; uri: string } // 本机有，等上传
  | { kind: 'synced'; uri: string } // 已上传，本机有缓存
  | { kind: 'download'; fileId: string; stale: string | null } // 云端有，本机没有或缓存是旧照片（stale = 要删的旧缓存）

export function photoState(p: PhotoFields, canSync: boolean): PhotoState {
  if (p.photoFileId) {
    if (p.photo && p.photoCachedFor === p.photoFileId) return { kind: 'synced', uri: p.photo }
    return { kind: 'download', fileId: p.photoFileId, stale: p.photo }
  }
  // 没有云端 id：本机照片若是“某张云端照片的缓存”，说明别的手机把照片删了，不再显示
  if (p.photo && !p.photoCachedFor) return canSync ? { kind: 'pending', uri: p.photo } : { kind: 'local', uri: p.photo }
  return { kind: 'none' }
}

export const photoUriOf = (s: PhotoState) => ('uri' in s ? s.uri : null)
