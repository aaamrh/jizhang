import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Button } from '../../components/Button'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Segmented } from '../../components/Chip'
import { attempt } from '../../components/dialogs'
import { Plus } from '../../components/icons/ui'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { SortableList } from '../../components/SortableList'
import { Txt } from '../../components/Txt'
import { categoryActions } from '../../hooks/actions'
import { useCategories } from '../../hooks/data'
import { radius, space, tierColors } from '../../theme'
import { TIER_LABEL, type CategoryType } from '../../types/domain'
import type { StackProps } from '../../types/navigation'

export default function CategoriesPage({ navigation }: StackProps<'Categories'>) {
  const [type, setType] = useState<CategoryType>('expense')
  const [dragging, setDragging] = useState(false)
  const list = useCategories(type, true)

  return (
    <Screen
      scrollEnabled={!dragging}
      footer={<Button title="新建分类" icon={Plus} variant="primary" onPress={() => navigation.navigate('CategoryForm', { type })} />}
    >
      <Segmented
        options={[
          { value: 'expense', label: '支出' },
          { value: 'income', label: '收入' },
        ]}
        value={type}
        onChange={setType}
      />
      <Section title="按住右侧拖动排序，记账页按这个顺序显示" plain>
        <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
          <SortableList
            items={list}
            keyOf={(c) => c.id}
            onDragging={setDragging}
            onReorder={(items) => attempt(() => categoryActions.reorder(items.map((c) => c.id)))}
            render={(c) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.name}
                onPress={() => navigation.navigate('CategoryForm', { id: c.id, type: c.type })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, height: '100%', paddingLeft: space.md }}
              >
                <CategoryIcon icon={c.icon} color={c.color} />
                <Txt style={{ flex: 1 }} muted={c.hidden} numberOfLines={1}>
                  {c.name}
                  {c.hidden ? '（已隐藏）' : ''}
                </Txt>
                {c.tier ? (
                  <Txt v="caption" color={tierColors[c.tier]}>
                    {TIER_LABEL[c.tier]}
                  </Txt>
                ) : null}
              </Pressable>
            )}
          />
        </View>
      </Section>
      <Txt v="caption" faint>
        必要程度（必需 / 弹性 / 享受）只在统计里用到，记账时不显示。
      </Txt>
    </Screen>
  )
}
