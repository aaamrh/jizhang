import type { LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { colors, ICON_STROKE, iconSize, size as sizes, tint } from '../theme'
import { RetroGlyph } from './RetroGlyph'

export type IconSize = keyof typeof iconSize

/** 界面图标：尺寸、线宽只从令牌取 */
export function Icon({ as: C, size = 'list', color = colors.ink }: { as: LucideIcon; size?: IconSize; color?: string }) {
  return <C size={iconSize[size]} color={color} strokeWidth={ICON_STROKE} />
}

/** 圆形图标底：列表行左侧 40px；颜色淡染 12%，filled 时实心 */
export function IconCircle({
  children,
  color = colors.ink,
  diameter = sizes.circle,
  filled,
}: {
  children: ReactNode
  color?: string
  diameter?: number
  filled?: boolean
}) {
  return (
    <View
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        backgroundColor: filled ? color : tint(color, color === colors.ink ? 0.06 : 0.12),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  )
}

/** 列表行常用：圆底 + 界面图标 */
export function RowIcon({ as, color = colors.ink }: { as: LucideIcon; color?: string }) {
  return (
    <IconCircle color={color}>
      <Icon as={as} color={color} />
    </IconCircle>
  )
}

/** 功能图标：自绘复古图标放在 40px 淡染圆底里（快捷入口、设置行、空状态）。Lucide 只用于返回、搜索等界面控件 */
export function FeatureIcon({ name, color = colors.ink, large }: { name: string; color?: string; large?: boolean }) {
  return (
    <IconCircle color={color} diameter={large ? sizes.circleLg : sizes.circle}>
      <RetroGlyph name={name} color={color} px={large ? iconSize.glyphLg : iconSize.glyph} />
    </IconCircle>
  )
}
