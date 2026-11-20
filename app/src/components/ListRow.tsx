import type { LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { Toggle } from './Toggle'
import { colors, size, space } from '../theme'
import { FeatureIcon, Icon, RowIcon } from './Icon'
import { ChevronRight } from './icons/ui'
import { Txt, useFontScale } from './Txt'

export interface ListRowProps {
  title: string
  /** 跟在标题后面同一行（如账目上的标签） */
  titleExtra?: ReactNode
  subtitle?: string
  /** 左侧：传 Lucide 图标自动放进 40px 圆底；或自定义节点（如分类图标） */
  icon?: LucideIcon
  /** 左侧用自绘复古图标（优先于 icon） */
  glyph?: string
  iconColor?: string
  leading?: ReactNode
  /** 右侧值：字符串显示为次要文字；或自定义节点 */
  value?: ReactNode
  /** 右侧开关 */
  switchValue?: boolean
  /** 返回 false（或 Promise<false>）表示没改成，开关弹回去 */
  onSwitch?: (v: boolean) => void | boolean | Promise<void | boolean>
  onPress?: () => void
  /** 长按（如账目的操作菜单） */
  onLongPress?: () => void
  /** 有 onPress 时默认显示箭头；false 关闭 */
  chevron?: boolean
  danger?: boolean
  /** 标题用衬线（如家当名称） */
  serifTitle?: boolean
}

/**
 * 唯一的列表行：单行 56、两行 64，左右内边距 16，图标与文字间距 12。
 * 放在 Section 里，分隔线由 Section 统一画。
 */
export function ListRow({
  title,
  titleExtra,
  subtitle,
  icon,
  glyph,
  iconColor,
  leading,
  value,
  switchValue,
  onSwitch,
  onPress,
  onLongPress,
  chevron,
  danger,
  serifTitle,
}: ListRowProps) {
  const scale = useFontScale()
  const hasSwitch = onSwitch !== undefined
  const showChevron = chevron ?? (!!onPress && !hasSwitch)
  return (
    <Pressable
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          minHeight: (subtitle ? size.row2 : size.row) * scale,
          paddingHorizontal: space.md,
          paddingVertical: space.xs,
        },
        pressed && { backgroundColor: colors.fill },
      ]}
    >
      {leading ??
        (glyph ? (
          <FeatureIcon name={glyph} color={iconColor ?? colors.ink} />
        ) : icon ? (
          <RowIcon as={icon} color={iconColor ?? (danger ? colors.seal : colors.ink)} />
        ) : null)}
      <View style={{ flex: 1, gap: 2 }}>
        {titleExtra ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Txt v={serifTitle ? 'h2' : 'body'} color={danger ? colors.seal : colors.ink} numberOfLines={1} style={{ flexShrink: 1 }}>
              {title}
            </Txt>
            {titleExtra}
          </View>
        ) : (
          <Txt v={serifTitle ? 'h2' : 'body'} color={danger ? colors.seal : colors.ink} numberOfLines={1}>
            {title}
          </Txt>
        )}
        {subtitle ? (
          <Txt v="small" muted numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {typeof value === 'string' ? (
        <Txt muted numberOfLines={1} style={{ maxWidth: '45%' }}>
          {value}
        </Txt>
      ) : (
        value
      )}
      {hasSwitch ? (
        <Toggle label={title} value={!!switchValue} onChange={onSwitch!} />
      ) : null}
      {showChevron ? <Icon as={ChevronRight} size="list" color={colors.ink3} /> : null}
    </Pressable>
  )
}
