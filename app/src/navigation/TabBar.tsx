import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '../components/Button'
import { PressScale } from '../components/motion'
import { Plus } from '../components/icons/ui'
import { Sheet } from '../components/Sheet'
import { TemplateList } from '../components/TemplateStrip'
import { TabGlyph, type TabName } from '../components/TabGlyph'
import { Txt } from '../components/Txt'
import { colors, GUTTER, hairline, iconSize, radius, shadowSeal, size, space, type, vip } from '../theme'
import { useAuth } from '../store/authStore'
import { recordTemplateNow } from '../hooks/actions'
import { useTemplates } from '../hooks/data'
import type { TabParams } from '../types/navigation'

const META: Record<keyof TabParams, { label: string; glyph: TabName }> = {
  Home: { label: '流水', glyph: 'ledger' },
  Stats: { label: '盘账', glyph: 'stats' },
  Assets: { label: '家当', glyph: 'chest' },
  Mine: { label: '掌柜', glyph: 'me' },
}

/** 底栏：流水 · 盘账 · [记] · 家当 · 掌柜；让出底部安全区（手势条）。长按「记」弹出常记 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const isVip = useAuth((s) => !!s.user?.isVip)
  const [quick, setQuick] = useState(false)
  const templates = useTemplates()
  const root = () => navigation.getParent()
  const tab = (index: number) => {
    const route = state.routes[index]!
    const meta = META[route.name as keyof TabParams]
    const on = state.index === index
    const color = on ? colors.active : colors.ink2
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={meta.label}
        onPress={() => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!on && !e.defaultPrevented) navigation.navigate(route.name)
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xxs / 2 }}
      >
        <View>
          <TabGlyph name={meta.glyph} color={color} />
          {/* 大掌柜：掌柜图标右上角一个小金点 */}
          {route.name === 'Mine' && isVip ? (
            <View style={{ position: 'absolute', right: -3, top: -1, width: 7, height: 7, borderRadius: 4, backgroundColor: vip.gold, borderWidth: 1, borderColor: colors.surface }} />
          ) : null}
        </View>
        <Txt style={[type.tab, { color }]}>{meta.label}</Txt>
      </Pressable>
    )
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        height: size.tabBar + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: colors.surface,
        borderTopWidth: hairline,
        borderColor: colors.hair,
      }}
    >
      {tab(0)}
      {tab(1)}
      <View style={{ flex: 1, alignItems: 'center', marginTop: -space.md }}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="记一笔"
          scaleTo={0.9}
          accessibilityHint="长按可以快速记常记"
          onPress={() => root()?.navigate('EntryEdit', {})}
          onLongPress={() => setQuick(true)}
          delayLongPress={350}
          style={[
            {
              width: size.fab,
              height: size.fab,
              borderRadius: radius.md,
              backgroundColor: colors.seal,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ rotate: '-4deg' }],
            },
            shadowSeal,
          ]}
        >
          {/* 一方印：朱红圆角方印、内一道细白边、正中加号（原来写个“记”字，用户嫌像贴了张标签） */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: space.xxs, left: space.xxs, right: space.xxs, bottom: space.xxs, borderRadius: radius.sm, borderWidth: 1.2, borderColor: 'rgba(255,253,248,0.7)' }}
          />
          <Plus size={iconSize.nav} color={colors.surface} strokeWidth={2.6} />
        </PressScale>
      </View>
      {tab(2)}
      {tab(3)}
      <Sheet visible={quick} onClose={() => setQuick(false)} title="常记 · 点一下就记上">
        <TemplateList
          items={templates}
          onRecord={(t) => {
            if (recordTemplateNow(t)) setQuick(false)
          }}
        />
        <View style={{ paddingHorizontal: GUTTER, paddingTop: space.sm }}>
          <Button
            title={templates.length ? '管理常记' : '添加常记'}
            variant="secondary"
            onPress={() => {
              setQuick(false)
              if (templates.length) root()?.navigate('Templates')
              else root()?.navigate('TemplateForm', {})
            }}
          />
        </View>
      </Sheet>
    </View>
  )
}
