import { memo } from 'react'
import { Pressable, View } from 'react-native'
import { colors, size, space } from '../theme'
import type { Category } from '../types/domain'
import { CategoryIcon } from './CategoryIcon'
import { Icon, IconCircle } from './Icon'
import { Plus } from './icons/ui'
import { Txt } from './Txt'

/** 记账时选分类：每行 4 个（长辈模式 3 个）；最后一格是“添加”（新建一个分类）。不显示档位，保持中立 */
const CELL = (big?: boolean) => ({ width: big ? '33.33%' : '25%', alignItems: 'center', gap: space.xs, paddingVertical: space.sm }) as const

/** 一格分类：只有自己的选中状态变了才重新渲染（点分类时不重画整张网格里几十个图标） */
const Cell = memo(function Cell({ c, on, big, onChange }: { c: Category; on: boolean; big?: boolean; onChange: (id: string) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={c.name}
      onPress={() => onChange(c.id)}
      style={({ pressed }) => [CELL(big), pressed && { opacity: 0.6 }]}
    >
      <CategoryIcon icon={c.icon} color={c.color} variant="lg" selected={on} />
      <Txt v="caption" numberOfLines={1} color={on ? colors.ink : colors.ink2}>
        {c.name}
      </Txt>
    </Pressable>
  )
})

/** 记账时选分类：每行 4 个（长辈模式 3 个）；最后一格是“添加”（新建一个分类）。不显示档位，保持中立 */
export function CategoryGrid({
  items,
  value,
  onChange,
  onAdd,
  big,
}: {
  items: Category[]
  value: string | null
  /** 传稳定的函数（如 useState 的 setter），格子才能跳过重渲染 */
  onChange: (id: string) => void
  onAdd?: () => void
  /** 长辈模式：每行 3 个 */
  big?: boolean
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((c) => (
        <Cell key={c.id} c={c} on={c.id === value} big={big} onChange={onChange} />
      ))}
      {onAdd ? (
        <Pressable accessibilityRole="button" accessibilityLabel="添加分类" onPress={onAdd} style={({ pressed }) => [CELL(big), pressed && { opacity: 0.6 }]}>
          <IconCircle diameter={size.circleLg}>
            <Icon as={Plus} size="nav" color={colors.ink2} />
          </IconCircle>
          <Txt v="caption" muted>
            添加
          </Txt>
        </Pressable>
      ) : null}
    </View>
  )
}
