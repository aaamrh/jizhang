import { View } from 'react-native'
import { colors, space } from '../theme'
import type { Verse } from '../utils/goals'
import { Txt } from './Txt'

/** 一句古诗（霞鹜文楷）+ 一句白话 + 出处；light 用在深色底（提示条、弹窗遮罩）上 */
export function VerseBlock({ v, light, align = 'center' }: { v: Verse; light?: boolean; align?: 'center' | 'left' }) {
  const main = light ? colors.white : colors.ink
  const sub = light ? 'rgba(255,255,255,0.8)' : colors.ink2
  const center = align === 'center'
  return (
    <View style={{ gap: space.xxs, alignItems: center ? 'center' : 'flex-start' }}>
      <Txt v="h2" color={main} center={center}>
        「{v.verse}」
      </Txt>
      <Txt v="small" color={sub} center={center}>
        {v.plain}
      </Txt>
      <Txt v="caption" color={sub} center={center} style={{ alignSelf: center ? 'flex-end' : 'flex-start', opacity: 0.85 }}>
        ——{v.author}
      </Txt>
    </View>
  )
}
