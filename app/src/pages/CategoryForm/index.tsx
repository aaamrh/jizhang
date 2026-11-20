import { useLayoutEffect, useState } from 'react'
import { View } from 'react-native'
import { Button } from '../../components/Button'
import { CategoryIcon } from '../../components/CategoryIcon'
import { attempt } from '../../components/dialogs'
import { Check } from '../../components/icons/ui'
import { Icon } from '../../components/Icon'
import { ColorPicker, IconPicker } from '../../components/IconPicker'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { categoryActions } from '../../hooks/actions'
import { useCategory } from '../../hooks/data'
import { colors, space, tierColors } from '../../theme'
import { isSystemCategory, TIER_HINT, TIER_LABEL, type Tier } from '../../types/domain'
import type { StackProps } from '../../types/navigation'
import { FALLBACK_ICON, suggestIcon, type ColorKey, type IconSpec } from '../../utils/iconCatalog'

const TIERS: Tier[] = ['need', 'flex', 'want']

export default function CategoryFormPage({ navigation, route }: StackProps<'CategoryForm'>) {
  const { id, type } = route.params
  const cur = useCategory(id)
  const [name, setName] = useState(cur?.name ?? '')
  const [icon, setIcon] = useState<IconSpec>(cur?.icon ?? { kind: 'retro', name: FALLBACK_ICON })
  const [color, setColor] = useState<ColorKey>(cur?.color ?? 'zhuhong')
  const [tier, setTier] = useState<Tier>(cur?.tier ?? 'flex')
  // 用户自己挑过图标后，改名称就不再自动推荐
  const [iconTouched, setIconTouched] = useState(!!id)

  useLayoutEffect(() => navigation.setOptions({ title: id ? '编辑分类' : type === 'expense' ? '新建支出分类' : '新建收入分类' }), [navigation, id, type])

  const onName = (v: string) => {
    setName(v)
    if (iconTouched) return
    const s = suggestIcon(v)
    setIcon({ kind: 'retro', name: s ?? FALLBACK_ICON })
  }

  const save = () => {
    const v = { name, icon, color, tier: type === 'expense' ? tier : null }
    if (attempt(() => (id ? categoryActions.update(id, v) : categoryActions.create({ ...v, type })))) navigation.goBack()
  }

  const system = !!cur && isSystemCategory(cur)

  return (
    <Screen footer={<Button title="保存" variant="primary" onPress={save} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <CategoryIcon icon={icon} color={color} variant="lg" />
        <View style={{ flex: 1 }}>
          <TextField value={name} onChangeText={onName} placeholder="分类名称，比如：奶茶、健身" maxLength={8} autoFocus={!id} accessibilityLabel="名称" />
        </View>
      </View>

      <Section title="图标">
        <IconPicker
          value={icon}
          color={color}
          name={name}
          onChange={(v) => {
            setIconTouched(true)
            setIcon(v)
          }}
        />
      </Section>
      <Section title="颜色">
        <ColorPicker value={color} onChange={setColor} />
      </Section>

      {type === 'expense' ? (
        <Section list title="必要程度（只用在统计里，记账时不显示）">
          {TIERS.map((t) => (
            <ListRow
              key={t}
              title={TIER_LABEL[t]}
              subtitle={TIER_HINT[t]}
              chevron={false}
              leading={<View style={{ width: space.xs, height: space.xl, borderRadius: space.xxs, backgroundColor: tierColors[t] }} />}
              value={tier === t ? <Icon as={Check} color={colors.active} /> : undefined}
              onPress={() => setTier(t)}
            />
          ))}
        </Section>
      ) : null}

      {id && cur ? (
        system ? (
          <Txt v="small" muted>
            「变卖」是系统分类，家当卖出时自动使用，不能隐藏或合并。
          </Txt>
        ) : (
          <Section list>
            <ListRow
              title={cur.hidden ? '取消隐藏' : '隐藏'}
              subtitle={cur.hidden ? undefined : '历史账目保留，记账时不出现'}
              onPress={() => attempt(() => categoryActions.setHidden(cur.id, !cur.hidden)) && navigation.goBack()}
            />
            <ListRow title="合并到另一个分类" onPress={() => navigation.navigate('CategoryMerge', { id: cur.id })} />
          </Section>
        )
      ) : null}
    </Screen>
  )
}
