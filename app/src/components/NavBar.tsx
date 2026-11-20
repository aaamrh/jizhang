import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, GUTTER, size, space } from '../theme'
import { Icon } from './Icon'
import { ChevronLeft, X } from './icons/ui'
import { Txt } from './Txt'

/**
 * 统一的顶部导航栏：高 52 + 顶部安全区，标题衬线居中，返回图标 24。
 * 所有二级页面都用它（导航器里配置），记一笔页自己放一个关闭版。
 */
export function NavBar({
  title,
  onBack,
  close,
  right,
  center,
}: {
  title?: string
  onBack?: () => void
  /** 返回图标换成关闭（弹出式页面） */
  close?: boolean
  right?: ReactNode
  /** 自定义中间内容（如记一笔的类型切换） */
  center?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const side = { width: size.buttonMd, height: size.buttonMd, alignItems: 'center', justifyContent: 'center' } as const
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.bg }}>
      <View style={{ height: size.navBar, flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER - space.xs, gap: space.xs }}>
        <View style={side}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel={close ? '关闭' : '返回'} hitSlop={space.xs} onPress={onBack} style={side}>
              <Icon as={close ? X : ChevronLeft} size="nav" color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {center ?? (
            <Txt v="h2" numberOfLines={1}>
              {title}
            </Txt>
          )}
        </View>
        <View style={[side, { width: undefined, minWidth: size.buttonMd }]}>{right}</View>
      </View>
    </View>
  )
}

/** 导航栏右侧的图标按钮 */
export function NavAction({ icon, label, onPress }: { icon: Parameters<typeof Icon>[0]['as']; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={space.xs} onPress={onPress} style={{ padding: space.xs }}>
      <Icon as={icon} size="nav" color={colors.ink} />
    </Pressable>
  )
}
