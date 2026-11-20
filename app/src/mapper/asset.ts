import type { AssetRow } from '../db/schema'
import type { Asset, AssetStatus } from '../types/domain'
import { oneOf } from './narrow'

const STATUSES: AssetStatus[] = ['holding', 'sold', 'lost', 'broken']

export function toAsset(r: AssetRow, fromTxn: boolean): Asset {
  return {
    id: r.id,
    ledgerId: r.ledgerId,
    name: r.name,
    costCents: r.costCents,
    acquiredOn: r.acquiredOn,
    status: oneOf(r.status, STATUSES, 'holding'),
    endedOn: r.endedOn,
    soldCents: r.soldCents,
    soldWalletId: r.soldWalletId,
    useCount: r.useCount,
    note: r.note,
    costMode: r.costMode === 'use' ? 'use' : 'day',
    photo: r.photo ?? null,
    photoFileId: r.photoFileId ?? null,
    photoCachedFor: r.photoCachedFor ?? null,
    fromTxn,
  }
}
