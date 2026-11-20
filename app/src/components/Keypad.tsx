import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { colors, hairline, size, space } from '../theme'
import type { CalcKey } from '../utils/calc'
import { Icon } from './Icon'
import { Calendar, Delete } from './icons/ui'
import { Txt, useFontScale } from './Txt'

/**
 * 记账键盘 4×4：
 *   7 8 9 日期
 *   4 5 6 +
 *   1 2 3 −
 *   . 0 ⌫ 完成
 * 按键平铺、细线分隔；“完成”朱红实心。日期键由外部传入（点开日期选择）。
 */
export function Keypad({
  onKey,
  dateLabel,
  dateSub,
  onDate,
  doneLabel,
  onDone,
}: {
  onKey: (k: CalcKey) => void
  dateLabel: string
  /** 日期键第二行小字（设了重复：“每月 20 日”） */
  dateSub?: string
  onDate: () => void
  doneLabel: string
  onDone: () => void
}) {
  const scale = useFontScale()
  const h = size.key * scale
  const key = (k: string, label: ReactNode, onPress: () => void, opts: { done?: boolean; a11y?: string } = {}) => (
    <Pressable
      key={k}
      accessibilityRole="button"
      accessibilityLabel={opts.a11y ?? k}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          height: h,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: opts.done ? colors.seal : colors.surface,
          borderLeftWidth: hairline,
          borderColor: colors.hair,
        },
        pressed && { backgroundColor: opts.done ? colors.seal : colors.fill, opacity: opts.done ? 0.85 : 1 },
      ]}
    >
      {typeof label === 'string' ? (
        opts.done ? (
          <Txt v="h2" color={colors.white} style={{ fontFamily: undefined }} medium>
            {label}
          </Txt>
        ) : (
          <Txt v="title" style={{ fontFamily: undefined }}>
            {label}
          </Txt>
        )
      ) : (
        label
      )}
    </Pressable>
  )
  const digit = (d: CalcKey) => key(d, d === '-' ? '−' : d, () => onKey(d))
  const rows: ReactNode[][] = [
    [
      digit('7'),
      digit('8'),
      digit('9'),
      key(
        'date',
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
            <Icon as={Calendar} size="inline" color={colors.ink} />
            <Txt v="small">{dateLabel}</Txt>
          </View>
          {dateSub ? (
            <Txt v="caption" muted numberOfLines={1}>
              {dateSub}
            </Txt>
          ) : null}
        </View>,
        onDate,
        { a11y: `日期：${dateLabel}${dateSub ? `，${dateSub}重复` : ''}` },
      ),
    ],
    [digit('4'), digit('5'), digit('6'), digit('+')],
    [digit('1'), digit('2'), digit('3'), digit('-')],
    [
      digit('.'),
      digit('0'),
      key('back', <Icon as={Delete} size="nav" color={colors.ink} />, () => onKey('back'), { a11y: '退格' }),
      key('done', doneLabel, onDone, { done: true, a11y: doneLabel === '=' ? '计算' : '完成' }),
    ],
  ]
  return (
    <View style={{ borderTopWidth: hairline, borderColor: colors.hair }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', borderBottomWidth: hairline, borderColor: colors.hair, marginLeft: -hairline }}>
          {r}
        </View>
      ))}
    </View>
  )
}
