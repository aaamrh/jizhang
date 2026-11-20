import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { categoryColors, colors, hairline, radius, size, space } from '../theme'
import { COLOR_KEYS, COLOR_LABEL, firstChar, ICON_GROUPS, iconLabel, iconsInGroup, type ColorKey, type IconGroup, type IconSpec } from '../utils/iconCatalog'
import { CategoryIcon } from './CategoryIcon'
import { Chip } from './Chip'
import { Seal } from './Seal'
import { TextField } from './TextField'

type Tab = IconGroup | '文字'

/** 选图标：按组分页的图标，或“文字”页输入一个字做印章 */
export function IconPicker({ value, color, name, onChange }: { value: IconSpec; color: ColorKey; name: string; onChange: (v: IconSpec) => void }) {
  const [tab, setTab] = useState<Tab>(value.kind === 'char' ? '文字' : '餐饮')
  const [char, setChar] = useState(value.kind === 'char' ? value.char : firstChar(name || '账'))
  const tabs: Tab[] = [...ICON_GROUPS, '文字']
  return (
    <View style={{ gap: space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
        {tabs.map((t) => (
          <Chip key={t} label={t} selected={t === tab} onPress={() => setTab(t)} />
        ))}
      </ScrollView>
      {tab === '文字' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Seal char={firstChar(char || '账')} px={size.circleLg} color={categoryColors[color]} />
          <View style={{ flex: 1 }}>
            <TextField
              value={char}
              onChangeText={(v) => {
                setChar(v)
                if (v.trim()) onChange({ kind: 'char', char: firstChar(v) })
              }}
              placeholder="输入一个字"
              accessibilityLabel="印章文字"
            />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm }}>
          {iconsInGroup(tab).map((n) => {
            const on = value.kind === 'retro' && value.name === n
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={iconLabel(n)}
                accessibilityState={{ selected: on }}
                onPress={() => onChange({ kind: 'retro', name: n })}
                style={{ width: '20%', alignItems: 'center' }}
              >
                <CategoryIcon icon={{ kind: 'retro', name: n }} color={on ? color : 'mo'} selected={on} />
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

export function ColorPicker({ value, onChange }: { value: ColorKey; onChange: (c: ColorKey) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm }}>
      {COLOR_KEYS.map((k) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={COLOR_LABEL[k]}
          accessibilityState={{ selected: k === value }}
          onPress={() => onChange(k)}
          style={{ width: '12.5%', alignItems: 'center' }}
        >
          <View
            style={{
              width: size.buttonSm + space.xs,
              height: size.buttonSm + space.xs,
              borderRadius: radius.pill,
              borderWidth: hairline * 4,
              borderColor: k === value ? categoryColors[k] : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: size.buttonSm - space.xxs, height: size.buttonSm - space.xxs, borderRadius: radius.pill, backgroundColor: categoryColors[k] }} />
          </View>
        </Pressable>
      ))}
    </View>
  )
}
