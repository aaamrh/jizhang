import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { colors } from '../theme'

/**
 * 日历、日子选择里“选中的那天”：朱文框——一道朱红细框，像拿朱笔在账簿上框了一下，数字仍是墨色。
 * 用户从朱印、墨印、朱文框、笔圈、印泥点五种里选的（2026-11-20）；这是“选中用墨色”规矩的唯一例外。
 */
const f = (n: number) => n.toFixed(2)

/** 圆角方框，上边靠右留一道缺口，边中间略鼓（印章边框不会笔直） */
function framePath(w: number, h: number) {
  const i = 3
  const r = 4
  const [x0, y0, x1, y1] = [i, i, w - i, h - i]
  const gapStart = x1 - r - (x1 - x0) * 0.2
  const gapEnd = gapStart + 3
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  return [
    `M${f(gapEnd)} ${f(y0 + 0.2)}`,
    `L${f(x1 - r)} ${f(y0)} Q${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + r)}`,
    `L${f(x1 + 0.4)} ${f(my)} L${f(x1)} ${f(y1 - r)} Q${f(x1)} ${f(y1)} ${f(x1 - r)} ${f(y1)}`,
    `L${f(mx)} ${f(y1 + 0.4)} L${f(x0 + r)} ${f(y1)} Q${f(x0)} ${f(y1)} ${f(x0)} ${f(y1 - r)}`,
    `L${f(x0 - 0.3)} ${f(my)} L${f(x0)} ${f(y0 + r)} Q${f(x0)} ${f(y0)} ${f(x0 + r)} ${f(y0)}`,
    `L${f(gapStart)} ${f(y0 - 0.2)}`,
  ].join(' ')
}

/** 画在数字后面，铺满格子（w、h 是格子的大小）；月份、年份那种宽格子也能画 */
export function PickMark({ w, h }: { w: number; h: number }) {
  if (!w || !h) return null
  const d = framePath(w, h)
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transform: [{ rotate: '-3deg' }] }}>
      <Svg width={w} height={h}>
        <Path d={d} stroke={colors.seal} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* 印泥不匀：再压一道淡的，略错开 */}
        <Path d={d} stroke={colors.seal} strokeWidth={1} strokeOpacity={0.35} fill="none" transform="translate(0.6 0.5)" />
      </Svg>
    </View>
  )
}
