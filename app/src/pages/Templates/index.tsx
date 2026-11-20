import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Button } from '../../components/Button'
import { CategoryIcon } from '../../components/CategoryIcon'
import { attempt } from '../../components/dialogs'
import { Plus } from '../../components/icons/ui'
import { EmptyState } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { SortableList } from '../../components/SortableList'
import { Txt } from '../../components/Txt'
import { deleteTemplateFlow, templateActions } from '../../hooks/actions'
import { SwipeRow } from '../../components/SwipeRow'
import { useTemplates } from '../../hooks/data'
import { colors, expenseColor, incomeColor, radius, size, space } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { formatPlain } from '../../utils/money'

/** 常记：常用的一笔存起来，记一笔页顶部或长按「记」点一下就记上 */
export default function TemplatesPage({ navigation }: StackProps<'Templates'>) {
  const list = useTemplates()
  const [dragging, setDragging] = useState(false)
  return (
    <Screen
      scrollEnabled={!dragging}
      footer={<Button title="添加常记" icon={Plus} variant="primary" onPress={() => navigation.navigate('TemplateForm', {})} />}
    >
      <Txt v="small" muted>
        比如“理发 30”“上班交通 2”。存好后在记一笔页顶部点一下，或者长按底部「记」，就按今天记上一笔，记错了可以马上撤销。左滑可以删除。
      </Txt>
      {list.length === 0 ? (
        <EmptyState glyph="steelyard" text="还没有常记" />
      ) : (
        <Section title="按住右侧拖动排序，左滑删除" plain>
          <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
            <SortableList
              items={list}
              keyOf={(t) => t.id}
              onDragging={setDragging}
              onReorder={(items) => attempt(() => templateActions.reorder(items.map((t) => t.id)))}
              render={(t) => (
                <SwipeRow onDelete={() => void deleteTemplateFlow(t)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.name}
                  onPress={() => navigation.navigate('TemplateForm', { id: t.id })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, height: size.row, paddingLeft: space.md, backgroundColor: colors.surface }}
                >
                  {t.categoryIcon ? <CategoryIcon icon={t.categoryIcon} color={t.categoryColor} /> : null}
                  <Txt style={{ flex: 1 }} numberOfLines={1}>
                    {t.name}
                  </Txt>
                  <Txt serif color={t.type === 'income' ? incomeColor : expenseColor}>
                    {t.type === 'income' ? '+' : '-'}
                    {formatPlain(t.amountCents)}
                  </Txt>
                </Pressable>
                </SwipeRow>
              )}
            />
          </View>
        </Section>
      )}
    </Screen>
  )
}
