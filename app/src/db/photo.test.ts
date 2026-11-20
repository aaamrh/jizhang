import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportLedger } from './backup'
import { createAsset, getAsset, setAssetPhoto } from './assetRepo'
import type { DB } from './core'
import { markUploaded, pendingUploads, setCached } from './photoRepo'
import { assets, ledgers } from './schema'
import { makeTestDb } from './testDb'

let db: DB
let L: string
let id: string

beforeEach(async () => {
  ;({ db, ledgerId: L } = await makeTestDb())
  id = createAsset(db, L, { name: '相机', costCents: 100, acquiredOn: '2026-01-01', note: '' })
})

describe('照片上传队列', () => {
  it('账本还没上云：不排队；上云后排队；上传完记下云端 id 并标记待同步', () => {
    setAssetPhoto(db, id, 'file:///a.jpg')
    expect(pendingUploads(db)).toEqual([])
    db.update(ledgers).set({ remote: true }).where(eq(ledgers.id, L)).run()
    expect(pendingUploads(db)).toEqual([{ table: 'assets', id, ledgerId: L, photo: 'file:///a.jpg' }])

    db.update(assets).set({ dirty: false }).where(eq(assets.id, id)).run()
    markUploaded(db, 'assets', id, 'file:///a.jpg', 'f1')
    const row = db.select().from(assets).where(eq(assets.id, id)).get()!
    expect(row).toMatchObject({ photoFileId: 'f1', photoCachedFor: 'f1', dirty: true })
    expect(pendingUploads(db)).toEqual([])
  })

  it('上传期间换了照片：旧上传结果不记，新照片继续排队', () => {
    db.update(ledgers).set({ remote: true }).where(eq(ledgers.id, L)).run()
    setAssetPhoto(db, id, 'file:///a.jpg')
    setAssetPhoto(db, id, 'file:///b.jpg')
    markUploaded(db, 'assets', id, 'file:///a.jpg', 'f-old')
    expect(getAsset(db, id)).toMatchObject({ photo: 'file:///b.jpg', photoFileId: null })
    expect(pendingUploads(db)).toHaveLength(1)
  })

  it('换照片返回旧云端 id（用来删云端旧文件），下载缓存不标记待同步', () => {
    db.update(assets).set({ photoFileId: 'f1', photoCachedFor: null, photo: null, dirty: false }).where(eq(assets.id, id)).run()
    setCached(db, 'assets', id, 'f1', 'file:///cache/f1.jpg')
    expect(db.select().from(assets).where(eq(assets.id, id)).get()).toMatchObject({ photo: 'file:///cache/f1.jpg', photoCachedFor: 'f1', dirty: false })
    expect(setAssetPhoto(db, id, 'file:///new.jpg')).toBe('f1')
  })

  it('导出的备份文件不含照片', () => {
    setAssetPhoto(db, id, 'file:///a.jpg')
    expect(exportLedger(db, L).assets[0]).toMatchObject({ photo: null, photoFileId: null })
    expect(exportLedger(db, L, { keepLocalPhotos: true }).assets[0]).toMatchObject({ photo: 'file:///a.jpg', photoFileId: null })
  })
})
