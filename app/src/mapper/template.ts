import type { TemplateRow } from '../db/schema'
import type { Template } from '../types/domain'
import { oneOf } from './narrow'
import { parseTags } from '../utils/tags'

export const toTemplate = (r: TemplateRow): Template => ({
  id: r.id,
  ledgerId: r.ledgerId,
  name: r.name,
  type: oneOf(r.type, ['expense', 'income'] as const, 'expense'),
  categoryId: r.categoryId,
  amountCents: r.amountCents,
  walletId: r.walletId,
  note: r.note,
  memberId: r.memberId,
  tags: parseTags(r.tags),
  sort: r.sort,
})
