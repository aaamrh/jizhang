import type { LedgerRow, MemberRow } from '../db/schema'
import type { RemoteMember } from '../types/api'
import type { Ledger, LedgerType, Member, MemberRole } from '../types/domain'
import { oneOf, oneOfOrNull } from './narrow'

const ROLES: MemberRole[] = ['admin', 'member', 'profile']
const LEDGER_TYPES: LedgerType[] = ['personal', 'book', 'family']

export const toLedger = (r: LedgerRow): Ledger => ({
  id: r.id,
  name: r.name,
  type: oneOf<LedgerType>(r.type, LEDGER_TYPES, 'personal'),
  remote: r.remote,
  myRole: oneOfOrNull(r.myRole, ['admin', 'member'] as const),
  cover: r.cover ?? null,
})

export const toMember = (r: MemberRow): Member => ({
  id: r.id,
  ledgerId: r.ledgerId,
  userId: r.userId,
  nickname: r.nickname,
  role: oneOf(r.role, ROLES, 'member'),
  elderMode: r.elderMode,
  isMe: r.isMe,
  removed: r.removed,
  isVip: r.isVip,
})

/** 服务器成员 → 本地镜像行 */
export const memberRowOf = (ledgerId: string, m: RemoteMember): MemberRow => ({
  id: m.id,
  ledgerId,
  userId: m.userId,
  nickname: m.nickname,
  role: m.role,
  elderMode: m.elderMode,
  isMe: m.isMe,
  removed: !!m.removed,
  isVip: !!m.isVip,
  joinedAt: Date.parse(m.joinedAt) || 0,
})
