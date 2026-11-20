import { describe, expect, it } from 'vitest'
import type { AssetRow, CategoryRow, TxnRow, WalletRow } from '../db/schema'
import { toAsset } from './asset'
import { toCategory } from './category'
import { fromSyncRecord, toSyncRecord } from './sync'
import { toTxn, toTxnView } from './txn'
import { toWallet } from './wallet'

const base = { id: 'x', ledgerId: 'L', updatedAt: 1, deletedAt: null, dirty: false }

describe('mapper', () => {
  it('钱袋：负债类由 kind 推出；未知 kind 回退为其他', () => {
    const r: WalletRow = { ...base, name: '花呗', kind: 'huabei', initialCents: -100, archived: false, sort: 0, key: null }
    expect(toWallet(r)).toMatchObject({ kind: 'huabei', liability: true, initialCents: -100 })
    expect(toWallet({ ...r, kind: 'weird' })).toMatchObject({ kind: 'other', liability: false })
  })

  it('分类：支出必有档位，收入没有；图标、颜色坏数据有回退', () => {
    const r: CategoryRow = { ...base, name: '外出就餐', type: 'expense', tier: 'bogus', icon: 'retro:bowl-chopsticks', color: 'zhuhong', sort: 0, hidden: false, key: 'expense.dining' }
    expect(toCategory(r)).toMatchObject({ tier: 'flex', icon: { kind: 'retro', name: 'bowl-chopsticks' }, color: 'zhuhong' })
    expect(toCategory({ ...r, type: 'income', tier: 'need' }).tier).toBeNull()
    expect(toCategory({ ...r, icon: '???', color: 'pink' })).toMatchObject({ icon: { kind: 'char', char: '外' }, color: 'mo' })
  })

  it('账目：类型和评价收窄；联表视图', () => {
    const r: TxnRow = {
      ...base,
      type: 'refund',
      amountCents: 100,
      categoryId: 'c',
      walletId: 'w',
      toWalletId: null,
      date: '2026-11-17',
      note: '',
      assetId: null,
      review: 'nope',
      createdBy: null,
      memberId: null,
      tags: '["报销","报销",3]',
      recurringId: null,
      photo: null,
      photoFileId: null,
      photoCachedFor: null,
      createdAt: 1,
    }
    expect(toTxn(r)).toMatchObject({ type: 'refund', review: null, tags: ['报销'] })
    const v = toTxnView({ txn: { ...r, review: 'worth' }, categoryName: '打车', categoryIcon: 'char:车', categoryColor: 'jin', tier: 'flex', walletName: null, toWalletName: null })
    // 旧值 'worth' 读成 'necessary'
    expect(v).toMatchObject({ review: 'necessary', categoryIcon: { kind: 'char', char: '车' }, categoryColor: 'jin', tier: 'flex', walletName: '已删除的钱袋' })
    expect(toTxnView({ txn: { ...r, type: 'transfer', categoryId: null }, categoryName: null, categoryIcon: null, categoryColor: null, tier: null, walletName: 'A', toWalletName: 'B' }).categoryIcon).toBeNull()
  })

  it('家当：状态收窄', () => {
    const r: AssetRow = { ...base, name: '手机', costCents: 1, acquiredOn: '2026-01-01', status: 'gone', endedOn: null, soldCents: null, soldWalletId: null, useCount: 0, note: '', costMode: 'weird', photo: null, photoFileId: null, photoCachedFor: null }
    expect(toAsset(r, true)).toMatchObject({ status: 'holding', fromTxn: true, costMode: 'day', photo: null })
  })

  it('照片：本机路径和缓存标记不上传，云端 id 随账目同步；收到服务器记录也不覆盖本机缓存', () => {
    const r = { ...base, name: '相机', photo: 'file:///x.jpg', photoCachedFor: 'f1', photoFileId: 'f1', costMode: 'use' }
    const rec = toSyncRecord(r)
    expect(rec.data).not.toHaveProperty('photo')
    expect(rec.data).not.toHaveProperty('photoCachedFor')
    expect(rec.data).toMatchObject({ photoFileId: 'f1' })
    expect(rec.data).toMatchObject({ costMode: 'use' })
    const back = fromSyncRecord({ ...rec, data: { ...rec.data, photo: 'file:///other.jpg' } }, ['name', 'photo', 'costMode'])
    expect(back).not.toHaveProperty('photo')
    expect(back).toMatchObject({ name: '相机', costMode: 'use' })
  })
})
