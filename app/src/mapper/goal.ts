import type { GoalRow } from '../db/schema'
import type { Goal } from '../types/domain'
import { oneOf } from './narrow'

export const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  ledgerId: r.ledgerId,
  name: r.name,
  targetCents: r.targetCents,
  deadline: r.deadline,
  walletId: r.walletId,
  status: oneOf(r.status, ['active', 'achieved', 'archived'] as const, 'active'),
  createdOn: r.createdOn,
  achievedOn: r.achievedOn,
  achievedCents: r.achievedCents,
  fulfilledOn: r.fulfilledOn,
  wish: r.wish,
  photo: r.photo,
  photoFileId: r.photoFileId ?? null,
  photoCachedFor: r.photoCachedFor ?? null,
})
