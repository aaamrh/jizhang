import type { WalletRow } from '../db/schema'
import { LIABILITY_KINDS, WALLET_KIND_LABEL, type Wallet, type WalletKind } from '../types/domain'
import { oneOf } from './narrow'

const KINDS = Object.keys(WALLET_KIND_LABEL) as WalletKind[]

export function toWallet(r: WalletRow): Wallet {
  const kind = oneOf(r.kind, KINDS, 'other')
  return {
    id: r.id,
    ledgerId: r.ledgerId,
    key: r.key,
    name: r.name,
    kind,
    liability: LIABILITY_KINDS.includes(kind),
    initialCents: r.initialCents,
    archived: r.archived,
    sort: r.sort,
  }
}
