import { useId, useMemo } from 'react'
import { View } from 'react-native'
import Svg, { Defs, Ellipse, Mask, Rect, Text as SvgText } from 'react-native-svg'
import { colors, hairline, radius, SERIF, size } from '../theme'
import { sealChars, sealWear } from '../utils/seal'
import { Txt } from './Txt'

/**
 * 印章。filled：白文印——红底，字是“刻”出来透出纸色的，字和边上有印泥没压匀的斑驳、边框断两三处
 * （Logo、应用锁、入账章、圆梦印、掌柜头像）。印文 1~4 个字，排法见 utils/seal 的 sealChars。
 * seed 决定斑驳的样子，默认用印文本身（同样的字每次画得一样）。
 * 不 filled：细框里一个彩色字（分类的单字图标）。
 */
export function Seal({
  char,
  px = size.seal,
  color = colors.seal,
  filled,
  seed,
}: {
  /** 印文，1~4 个字 */
  char: string
  px?: number
  color?: string
  filled?: boolean
  seed?: string
}) {
  if (!filled) {
    return (
      <View
        style={{
          width: px,
          height: px,
          borderRadius: radius.sm / 2,
          borderWidth: hairline * 3,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt v="h2" allowFontScaling={false} style={{ fontSize: px * 0.6, lineHeight: px * 0.82, color }}>
          {char}
        </Txt>
      </View>
    )
  }
  return <WhiteSeal text={char} px={px} color={color} seed={seed ?? char} />
}

function WhiteSeal({ text, px, color, seed }: { text: string; px: number; color: string; seed: string }) {
  const id = `seal${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const wear = useMemo(() => sealWear(seed), [seed])
  // 遮罩里白 = 留下印泥，黑 = 透出纸色（这两个是遮罩亮度，不是界面颜色）
  const KEEP = '#FFFFFF'
  const CUT = '#000000'
  return (
    <Svg width={px} height={px} viewBox="0 0 100 100" accessibilityLabel={`印章：${text}`}>
      <Defs>
        <Mask id={id} x="0" y="0" width="100" height="100" maskUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={100} height={100} fill={KEEP} />
          {sealChars(text).map(({ ch, x, y, size: fs }, i) => (
            <SvgText key={i} x={x} y={y} fontSize={fs} fontFamily={SERIF} textAnchor="middle" fill={CUT} stroke={CUT} strokeWidth={fs / 28} strokeLinejoin="round">
              {ch}
            </SvgText>
          ))}
          {wear.map((s, i) =>
            s.kind === 'dot' ? (
              <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} rotation={s.rot} origin={`${s.cx}, ${s.cy}`} fill={CUT} />
            ) : (
              <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={CUT} />
            ),
          )}
        </Mask>
      </Defs>
      <Rect x={1} y={1} width={98} height={98} rx={4} fill={color} opacity={0.93} mask={`url(#${id})`} />
    </Svg>
  )
}
