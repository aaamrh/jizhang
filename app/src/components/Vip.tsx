import { useEffect, useMemo, type ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { hairline, radius, size, space, vip } from '../theme'
import { VIP_NAME } from '../utils/copy'
import { SPRING } from './motion'
import { Txt } from './Txt'

// 大掌柜的身份标识：绛紫雷纹地、鎏金描边、腰牌、头像金边、开通时腰牌落下的动画

// 雷纹：一格 12 的小方回旋（青铜器上最常见的底纹）
const LEI = [[1, 11], [1, 1], [11, 1], [11, 11], [3.5, 11], [3.5, 3.5], [8.5, 3.5], [8.5, 8.5], [6, 8.5], [6, 6]] as const
const LEI_CELL = 12

/** 铺满 w×h 的雷纹拼成一条路径：一格正放、一格转九十度，交错排开 */
function leiwenPath(w: number, h: number) {
  let d = ''
  for (let r = 0; r * LEI_CELL < h; r++) {
    for (let c = 0; c * LEI_CELL < w; c++) {
      const turn = (r + c) % 2 === 1
      LEI.forEach(([x, y], i) => {
        const [px, py] = turn ? [LEI_CELL - y, x] : [x, y] // 绕格子中心转 90°
        d += `${i ? 'L' : 'M'}${c * LEI_CELL + px} ${r * LEI_CELL + py}`
      })
    }
  }
  return d
}

/** 雷纹地：鎏金细线、很淡，铺满给定区域（用户在回纹、雷纹、勾连纹几种里选的） */
export function Leiwen({ width, height, opacity = 0.18 }: { width: number; height: number; opacity?: number }) {
  const d = useMemo(() => leiwenPath(width, height), [width, height])
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Path d={d} fill="none" stroke={vip.gold} strokeOpacity={opacity} strokeWidth={0.9} />
    </Svg>
  )
}

/** 一道缓慢掠过的金光（尊重系统“减少动画”） */
export function Sheen({ width, height, delay = 1600, once = false }: { width: number; height: number; delay?: number; once?: boolean }) {
  const reduce = useReducedMotion()
  const x = useSharedValue(-width * 0.4)
  useEffect(() => {
    if (reduce) return
    const run = withDelay(delay, withTiming(width * 1.2, { duration: 1800, easing: Easing.inOut(Easing.quad) }))
    x.value = once ? run : withRepeat(withSequence(withTiming(-width * 0.4, { duration: 0 }), run), -1, false)
  }, [reduce, width, x, delay, once])
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: '18deg' }] }))
  if (reduce) return null
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -height * 0.3, width: width * 0.28, height: height * 1.6 }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="vipSheen" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={vip.goldLight} stopOpacity={0} />
            <Stop offset="0.5" stopColor={vip.goldLight} stopOpacity={0.35} />
            <Stop offset="1" stopColor={vip.goldLight} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vipSheen)" />
      </Svg>
    </Animated.View>
  )
}

/** 绛紫雷纹地 + 金色细描边的容器（掌柜页头） */
export function VipBand({ width, height, children, style }: { width: number; height: number; children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        { width, height, borderRadius: radius.md, overflow: 'hidden', backgroundColor: vip.purple, borderWidth: hairline * 2, borderColor: vip.gold },
        style,
      ]}
    >
      <Leiwen width={width} height={height} />
      {children}
    </View>
  )
}

/** 腰牌：挂在名字旁边的金色小牌子，写“大掌柜” */
export function Yaopai({ dark = false }: { dark?: boolean }) {
  const h = size.yaopai
  return (
    <View
      style={{
        height: h,
        paddingHorizontal: space.xs,
        borderRadius: h / 2,
        borderWidth: hairline * 2,
        borderColor: vip.gold,
        backgroundColor: dark ? 'rgba(201,162,77,0.16)' : vip.purple,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xxs,
      }}
    >
      <Svg width={10} height={10} viewBox="0 0 10 10">
        <Circle cx={5} cy={5} r={4} fill="none" stroke={vip.goldLight} strokeWidth={1.2} />
        <Rect x={3.5} y={3.5} width={3} height={3} fill="none" stroke={vip.goldLight} strokeWidth={1} />
      </Svg>
      <Txt v="caption" serif allowFontScaling={false} color={vip.goldLight} style={{ letterSpacing: 1 }}>
        {VIP_NAME}
      </Txt>
    </View>
  )
}

/** 头像金边：一圈鎏金，四角点缀云头 */
export function GoldRing({ px, children }: { px: number; children: ReactNode }) {
  const r = px / 2
  return (
    <View style={{ width: px + 8, height: px + 8, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={px + 8} height={px + 8} style={{ position: 'absolute' }}>
        <Circle cx={r + 4} cy={r + 4} r={r + 2.5} fill="none" stroke={vip.gold} strokeWidth={2} />
        {[0, 90, 180, 270].map((deg) => (
          <Circle key={deg} cx={r + 4 + (r + 2.5) * Math.cos((deg * Math.PI) / 180 - Math.PI / 4)} cy={r + 4 + (r + 2.5) * Math.sin((deg * Math.PI) / 180 - Math.PI / 4)} r={2.2} fill={vip.goldLight} />
        ))}
      </Svg>
      {children}
    </View>
  )
}

/** 会员卡（像黑金卡）：绛紫雷纹地，鎏金字，金印；active=false 时是“尚未开通”的样子 */
export function VipCard({ width, until, active }: { width: number; until: string | null; active: boolean }) {
  const height = width / size.vipCardRatio
  return (
    <View style={{ width, height, borderRadius: radius.md * 1.5, overflow: 'hidden', opacity: active ? 1 : 0.72 }}>
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="vipCard" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={vip.purple} />
            <Stop offset="1" stopColor={vip.purpleDeep} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#vipCard)" />
        <Rect x={8} y={8} width={width - 16} height={height - 16} rx={radius.md} fill="none" stroke={vip.gold} strokeOpacity={0.7} strokeWidth={1} />
      </Svg>
      <Leiwen width={width} height={height} />
      {active ? <Sheen width={width} height={height} delay={2400} /> : null}
      <View style={{ flex: 1, padding: space.xl, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: space.xxs }}>
            <Txt v="caption" color={vip.goldLight} style={{ letterSpacing: 4, opacity: 0.8 }}>
              账 房
            </Txt>
            <Txt v="display" color={vip.goldLight} style={{ letterSpacing: 6 }}>
              {VIP_NAME}
            </Txt>
          </View>
          <GoldSeal />
        </View>
        <Txt v="small" color={vip.goldLight} style={{ letterSpacing: 1 }}>
          {active && until ? `至 ${until.slice(0, 4)}年${Number(until.slice(5, 7))}月${Number(until.slice(8, 10))}日` : '尚未开通'}
        </Txt>
      </View>
    </View>
  )
}

/** 金印：“掌”字方印，鎏金 */
export function GoldSeal({ px = 44 }: { px?: number }) {
  return (
    <View style={{ width: px, height: px, borderRadius: radius.sm / 2, borderWidth: 2, borderColor: vip.gold, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] }}>
      <Txt v="h2" serif allowFontScaling={false} color={vip.gold} style={{ fontSize: px * 0.56, lineHeight: px * 0.78 }}>
        掌
      </Txt>
    </View>
  )
}

/** 小金印：成员列表里，大掌柜名字旁边 */
export function VipMark() {
  return (
    <View accessibilityLabel={VIP_NAME} style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: vip.purple, borderWidth: 1, borderColor: vip.gold, alignItems: 'center', justifyContent: 'center' }}>
      <Txt allowFontScaling={false} serif color={vip.goldLight} style={{ fontSize: 10, lineHeight: 13 }}>
        掌
      </Txt>
    </View>
  )
}

/** 开通那一刻：腰牌从上方落下、金光一闪。onDone 在动画结束后调用 */
export function VipUnlock({ width, onDone }: { width: number; onDone: () => void }) {
  const reduce = useReducedMotion()
  const y = useSharedValue(reduce ? 0 : -240)
  const fade = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (!reduce) {
      fade.value = withTiming(1, { duration: 200 })
      y.value = withSpring(0, { ...SPRING, damping: 12 })
    }
    const t = setTimeout(onDone, reduce ? 1200 : 2600)
    return () => clearTimeout(t)
  }, [reduce, y, fade, onDone])
  const drop = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: fade.value }))
  const cardW = Math.min(width, 360)
  return (
    <View pointerEvents="none" style={{ alignItems: 'center', gap: space.md }}>
      <Animated.View style={drop}>
        <VipCard width={cardW} until={null} active />
        <Sheen width={cardW} height={cardW / size.vipCardRatio} delay={500} once />
      </Animated.View>
      <Txt v="title" serif color={vip.goldLight} center>
        恭喜，您已是{VIP_NAME}
      </Txt>
    </View>
  )
}
