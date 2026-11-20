import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { colors, hairline, ICON_STROKE, space } from '../theme'

/** 回纹分隔线：两侧细线，中间一对回纹。只在页面里少量使用（分组之间、页头下方） */
export function Ornament({ color = colors.ink3 }: { color?: string }) {
  return (
    <View accessible={false} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.xxs }}>
      <View style={{ flex: 1, height: hairline, backgroundColor: colors.hair }} />
      <Svg width={28} height={10} viewBox="0 0 28 10" fill="none" stroke={color} strokeWidth={ICON_STROKE * 0.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M2 9V1h8v6H5V4h3" />
        <Path d="M26 1v8h-8V3h5v3h-3" />
      </Svg>
      <View style={{ flex: 1, height: hairline, backgroundColor: colors.hair }} />
    </View>
  )
}
