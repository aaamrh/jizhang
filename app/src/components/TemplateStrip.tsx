import { memo } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { categoryColors, colors, iconSize, size, space } from '../theme'
import type { TemplateView } from '../types/domain'
import { formatPlain } from '../utils/money'
import { CategoryGlyph, CategoryIcon } from './CategoryIcon'
import { Chip } from './Chip'
import { ListRow } from './ListRow'
import { Txt } from './Txt'

const label = (t: TemplateView) => `${t.name} ${formatPlain(t.amountCents)}`

/** 最多露出 3 行，多了在框里滚动 */
const MAX_ROWS = 3
const MAX_HEIGHT = MAX_ROWS * size.chip + (MAX_ROWS - 1) * space.xs

/**
 * 记一笔顶部的常记：胶囊按内容宽度自动换行，最多 3 行，超出在框内滚动；
 * 标题行右侧“管理”固定不动。点一下直接记上，长按编辑 / 删除
 */
export const TemplateStrip = memo(function TemplateStrip({
  items,
  onRecord,
  onManage,
  onLongPress,
}: {
  items: TemplateView[]
  onRecord: (t: TemplateView) => void
  onManage: () => void
  onLongPress: (t: TemplateView) => void
}) {
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="caption" muted>
          {items.length ? '常记 · 点一下记上，长按编辑' : '常记'}
        </Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="管理常记" hitSlop={space.sm} onPress={onManage}>
          <Txt v="small" color={colors.seal}>
            {items.length ? '管理' : '＋ 添加'}
          </Txt>
        </Pressable>
      </View>
      {items.length ? (
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          style={{ maxHeight: MAX_HEIGHT, flexGrow: 0 }}
          contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}
        >
          {items.map((t) => (
            <Chip
              key={t.id}
              label={label(t)}
              leading={t.categoryIcon ? <CategoryGlyph icon={t.categoryIcon} color={categoryColors[t.categoryColor]} px={iconSize.inline} /> : undefined}
              onPress={() => onRecord(t)}
              onLongPress={() => onLongPress(t)}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  )
})

/** 长按「记」弹出的常记列表：一行一条，点了就记 */
export function TemplateList({ items, onRecord }: { items: TemplateView[]; onRecord: (t: TemplateView) => void }) {
  return (
    <View>
      {items.map((t) => (
        <ListRow
          key={t.id}
          leading={t.categoryIcon ? <CategoryIcon icon={t.categoryIcon} color={t.categoryColor} /> : undefined}
          title={t.name}
          subtitle={t.type === 'income' ? '收入' : '支出'}
          value={formatPlain(t.amountCents)}
          chevron={false}
          onPress={() => onRecord(t)}
        />
      ))}
    </View>
  )
}
