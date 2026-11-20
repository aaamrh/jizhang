import { Text, type TextProps } from 'react-native'
import { useSettings } from '../store/settingsStore'
import { colors, ELDER_SCALE, SERIF, type } from '../theme'

export type TxtVariant = 'display' | 'amount' | 'title' | 'h2' | 'body' | 'small' | 'caption'

// 衬线只用于展示文字：标题、月份、金额
const SERIF_VARIANTS: TxtVariant[] = ['display', 'amount', 'title', 'h2']

interface Props extends TextProps {
  v?: TxtVariant
  color?: string
  /** 次要文字色 */
  muted?: boolean
  /** 更弱的文字色（占位、提示） */
  faint?: boolean
  center?: boolean
  /** 正文字号也用衬线（如列表里的金额） */
  serif?: boolean
  /** 无衬线中粗 */
  medium?: boolean
}

/** 字号倍数：长辈模式放大 */
export const useFontScale = () => useSettings((s) => (s.elderMode ? ELDER_SCALE : 1))

/** 全局唯一的文字组件：字号、字体、颜色都从令牌取 */
export function Txt({ v = 'body', color, muted, faint, center, serif, medium, style, ...rest }: Props) {
  const scale = useFontScale()
  const t = type[v]
  const isSerif = serif || SERIF_VARIANTS.includes(v)
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        {
          fontSize: t.fontSize * scale,
          lineHeight: t.lineHeight * scale,
          color: faint ? colors.ink3 : muted ? colors.ink2 : colors.ink,
          fontFamily: isSerif ? SERIF : undefined,
          fontVariant: ['tabular-nums'],
        },
        isSerif && v !== 'body' && { letterSpacing: 0.5 },
        medium && !isSerif && { fontWeight: '500' },
        color ? { color } : null,
        center && { textAlign: 'center' },
        style,
      ]}
    />
  )
}
