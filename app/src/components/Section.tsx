import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated'
import { itemLayout, rowHide, rowReveal } from './motion'
import { colors, hairline, radius, shadow, space } from '../theme'
import { Txt } from './Txt'

interface Props {
  title?: string
  /** 标题右侧的小操作，如“设置” */
  action?: { label: string; onPress: () => void }
  children: ReactNode
  /** 列表：子元素（ListRow）之间画分隔线，卡片无内边距 */
  list?: boolean
  /** 不要卡片底：内容直接放在页面上 */
  plain?: boolean
  /** 列表里有会出现 / 消失的行（如打开开关后多出的设置行）：新行从上一行里滑出、收起时滑回，其他行连同分隔线跟着让位；页面刚打开时不播 */
  animateRows?: boolean
  style?: ViewStyle
}

/**
 * 页面里的一组内容：小标题 + 一张纸面卡片。
 * 组与组之间的距离由 Screen 统一给（24），标题与卡片之间 8。
 */
export function Section({ title, action, children, list, plain, animateRows, style }: Props) {
  const items = Children.toArray(children).filter(isValidElement)
  return (
    <View style={[{ gap: space.xs }, style]}>
      {title || action ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xxs }}>
          <Txt v="small" muted style={{ letterSpacing: 1 }}>
            {title ?? ''}
          </Txt>
          {action ? (
            <Pressable accessibilityRole="button" hitSlop={space.sm} onPress={action.onPress}>
              <Txt v="small" color={colors.seal}>
                {action.label}
              </Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {plain ? (
        <View style={{ gap: space.sm }}>{children}</View>
      ) : (
        <View
          style={[
            { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
            shadow,
            !list && { padding: space.md, gap: space.sm },
          ]}
        >
          {list && animateRows ? (
            <LayoutAnimationConfig skipEntering>
              {items.map((c, i) => (
                <Animated.View key={c.key ?? i} entering={rowReveal} exiting={rowHide} layout={itemLayout}>
                  {i > 0 ? <View style={{ height: hairline, backgroundColor: colors.hair, marginLeft: space.md }} /> : null}
                  {c}
                </Animated.View>
              ))}
            </LayoutAnimationConfig>
          ) : list ? (
            items.map((c, i) => (
              <Fragment key={c.key ?? i}>
                {i > 0 ? <View style={{ height: hairline, backgroundColor: colors.hair, marginLeft: space.md }} /> : null}
                {c}
              </Fragment>
            ))
          ) : (
            children
          )}
        </View>
      )}
    </View>
  )
}
