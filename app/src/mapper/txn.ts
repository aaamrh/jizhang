import type { TxnRow } from '../db/schema'
import type { Tier, Txn, TxnType, TxnView } from '../types/domain'
import { COLOR_KEYS, parseIcon } from '../utils/iconCatalog'
import { TIERS } from './category'
import { legacyReview } from '../utils/necessity'
import { oneOf, oneOfOrNull } from './narrow'
import { parseTags } from '../utils/tags'

const TYPES: TxnType[] = ['expense', 'income', 'transfer', 'refund']

export function toTxn(r: TxnRow): Txn {
  return {
    id: r.id,
    ledgerId: r.ledgerId,
    type: oneOf(r.type, TYPES, 'expense'),
    amountCents: r.amountCents,
    categoryId: r.categoryId,
    walletId: r.walletId,
    toWalletId: r.toWalletId,
    date: r.date,
    note: r.note,
    assetId: r.assetId,
    review: legacyReview(r.review), // 兼容别的手机上传的旧值
    createdBy: r.createdBy,
    memberId: r.memberId,
    tags: parseTags(r.tags),
    recurringId: r.recurringId,
    photo: r.photo,
    photoFileId: r.photoFileId,
    photoCachedFor: r.photoCachedFor,
    createdAt: r.createdAt,
  }
}

/** 账目行 + 联表查出来的分类、钱袋信息 */
export interface TxnJoinRow {
  txn: TxnRow
  categoryName: string | null
  categoryIcon: string | null
  categoryColor: string | null
  tier: string | null
  walletName: string | null
  toWalletName: string | null
}

export function toTxnView(r: TxnJoinRow): TxnView {
  return {
    ...toTxn(r.txn),
    categoryName: r.categoryName,
    categoryIcon: r.categoryName === null ? null : parseIcon(r.categoryIcon, r.categoryName),
    categoryColor: oneOf(r.categoryColor, COLOR_KEYS, 'mo'),
    tier: oneOfOrNull<Tier>(r.tier, TIERS),
    walletName: r.walletName ?? '已删除的钱袋',
    toWalletName: r.toWalletName,
  }
}
