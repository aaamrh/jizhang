import type { ReactNode } from 'react'
import { TextInput, View, type TextInputProps } from 'react-native'
import { colors, hairline, radius, SERIF, size, space, type } from '../theme'
import { Txt, useFontScale } from './Txt'

interface Props extends Omit<TextInputProps, 'style'> {
  label?: string
  hint?: string
  error?: string | null
  /** 输入框内左侧，如 "¥" */
  prefix?: ReactNode
  /** 输入框内右侧，如 "元" */
  suffix?: ReactNode
  /** 金额等展示型输入：衬线大字 */
  display?: boolean
  align?: 'left' | 'right'
}

/** 唯一的输入框组件：高 48、左右内边距 16、圆角 12 */
export function TextField({ label, hint, error, prefix, suffix, display, align = 'left', multiline, ...rest }: Props) {
  const scale = useFontScale()
  const t = display ? type.title : type.body
  const side = (n: ReactNode) => (typeof n === 'string' ? <Txt muted>{n}</Txt> : n)
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Txt v="small" muted>{label}</Txt> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: space.xs,
          minHeight: size.input * scale,
          paddingHorizontal: space.md,
          paddingVertical: multiline ? space.sm : 0,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: hairline,
          borderColor: error ? colors.seal : colors.hair,
        }}
      >
        {prefix ? side(prefix) : null}
        <TextInput
          placeholderTextColor={colors.ink3}
          cursorColor={colors.active}
          selectionColor={colors.active}
          maxFontSizeMultiplier={1.4}
          multiline={multiline}
          {...rest}
          style={{
            flex: 1,
            paddingVertical: 0,
            fontSize: t.fontSize * scale,
            fontFamily: display ? SERIF : undefined,
            color: colors.ink,
            textAlign: align,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {suffix ? side(suffix) : null}
      </View>
      {error ? <Txt v="caption" color={colors.seal}>{error}</Txt> : hint ? <Txt v="caption" muted>{hint}</Txt> : null}
    </View>
  )
}
