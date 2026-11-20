import { describe, expect, it } from 'vitest'
import { photoState } from './photoState'

const p = (photo: string | null, photoFileId: string | null, photoCachedFor: string | null) => ({ photo, photoFileId, photoCachedFor })

describe('照片显示状态', () => {
  it('没照片', () => expect(photoState(p(null, null, null), true)).toEqual({ kind: 'none' }))
  it('只在本机：没登录是 local，能同步是 pending', () => {
    expect(photoState(p('a.jpg', null, null), false)).toEqual({ kind: 'local', uri: 'a.jpg' })
    expect(photoState(p('a.jpg', null, null), true)).toEqual({ kind: 'pending', uri: 'a.jpg' })
  })
  it('已同步且缓存对得上', () => expect(photoState(p('c.jpg', 'f1', 'f1'), true)).toEqual({ kind: 'synced', uri: 'c.jpg' }))
  it('云端换了照片：旧缓存要下载替换', () =>
    expect(photoState(p('old.jpg', 'f2', 'f1'), true)).toEqual({ kind: 'download', fileId: 'f2', stale: 'old.jpg' }))
  it('别的手机上传的，本机还没有', () => expect(photoState(p(null, 'f1', null), true)).toEqual({ kind: 'download', fileId: 'f1', stale: null }))
  it('别的手机删了照片：本机旧缓存不再显示', () => expect(photoState(p('c.jpg', null, 'f1'), true)).toEqual({ kind: 'none' }))
})
