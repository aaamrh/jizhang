import { Text } from 'react-native'
import { categoryColors, colors, iconSize, SERIF, size } from '../theme'
import type { ColorKey, IconSpec } from '../utils/iconCatalog'
import { IconCircle } from './Icon'
import { RetroGlyph } from './RetroGlyph'

/** 只画图标本身（没有圆底）。分类图标的来源只在这里切换 */
export function CategoryGlyph({ icon, color, px }: { icon: IconSpec; color: string; px: number }) {
  if (icon.kind === 'char') {
    return (
      <Text allowFontScaling={false} style={{ fontFamily: SERIF, fontSize: px * 0.9, lineHeight: px * 1.15, color }}>
        {icon.char}
      </Text>
    )
  }
  return <RetroGlyph name={icon.name} color={color} px={px} />
}

/**
 * 分类图标：淡染圆底 + 图标。
 * - md：列表行 40px；lg：记账分类网格 52px
 * - selected：实心圆、白色图标
 */
export function CategoryIcon({
  icon,
  color,
  variant = 'md',
  selected,
}: {
  icon: IconSpec
  color: ColorKey
  variant?: 'md' | 'lg'
  selected?: boolean
}) {
  const c = categoryColors[color]
  const lg = variant === 'lg'
  return (
    <IconCircle color={c} diameter={lg ? size.circleLg : size.circle} filled={selected}>
      <CategoryGlyph icon={icon} color={selected ? colors.white : c} px={lg ? iconSize.glyphLg : iconSize.glyph} />
    </IconCircle>
  )
}
