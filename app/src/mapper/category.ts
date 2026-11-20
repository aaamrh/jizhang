import type { CategoryRow } from '../db/schema'
import type { Category, CategoryType, Tier } from '../types/domain'
import { COLOR_KEYS, parseIcon } from '../utils/iconCatalog'
import { oneOf, oneOfOrNull } from './narrow'

const TYPES: CategoryType[] = ['expense', 'income']
export const TIERS: Tier[] = ['need', 'flex', 'want']

export function toCategory(r: CategoryRow): Category {
  const type = oneOf(r.type, TYPES, 'expense')
  return {
    id: r.id,
    ledgerId: r.ledgerId,
    name: r.name,
    type,
    // 支出分类必须有档位，脏数据按“弹性”处理；收入分类没有档位
    tier: type === 'expense' ? (oneOfOrNull(r.tier, TIERS) ?? 'flex') : null,
    icon: parseIcon(r.icon, r.name),
    color: oneOf(r.color, COLOR_KEYS, 'mo'),
    sort: r.sort,
    hidden: r.hidden,
    key: r.key,
  }
}
