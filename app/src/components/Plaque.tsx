import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { RETRO_ICONS } from '../assets/icons/retro'
import { colors } from '../theme'
import type { Goal } from '../types/domain'
import { durationLabel, tierOf, type PlaqueStage, type PlaqueTier } from '../utils/goals'
import { formatYuan } from '../utils/money'
import { SEAL_PHRASE } from '../utils/seal'
import { Seal } from './Seal'
import { Txt } from './Txt'

// 匾额：画布 320×200（宽高比 1.6），按 width 等比缩放。边框、纹样用 SVG 画，文字用 Txt 叠在上面（保证用上霞鹜文楷）
const W = 320
const H = 200

interface Look {
  frame: [string, string] // 边框渐变：亮 → 暗
  frameLine: string
  panel: string
  accent: string // 纹样线条
  text: string
  sub: string
  sealFilled: boolean
  sealColor: string
}

/** 五档样式：铜 素木 → 银 → 金 → 玉 → 聚宝盆，越往上越华丽 */
const LOOKS: Record<PlaqueTier, Look> = {
  copper: { frame: ['#B88A5E', '#7E5332'], frameLine: '#6A4428', panel: '#F4E8D2', accent: '#A86F3C', text: colors.ink, sub: '#7A6450', sealFilled: false, sealColor: colors.ink },
  silver: { frame: ['#EEF0F3', '#9EA7B2'], frameLine: '#8A939E', panel: '#FBFBF8', accent: '#9AA4AF', text: colors.ink, sub: colors.ink2, sealFilled: false, sealColor: '#5E6B78' },
  gold: { frame: ['#F3DC97', '#B8893B'], frameLine: '#9C7230', panel: '#FCF5E3', accent: '#C49A45', text: colors.ink, sub: '#8A6A35', sealFilled: true, sealColor: colors.seal },
  jade: { frame: ['#9CCFBE', '#2F6B5E'], frameLine: '#285A4F', panel: '#EFF6F2', accent: '#4E8C7B', text: '#A87A2E', sub: '#4E7D6E', sealFilled: true, sealColor: colors.seal },
  jubao: { frame: ['#F8E39C', '#A8741F'], frameLine: '#8A5E17', panel: '#7E2620', accent: '#E7C46A', text: '#F3D27A', sub: '#E9C98A', sealFilled: true, sealColor: '#E7C46A' },
}

/** 复古图标的路径画进匾额（与 RetroGlyph 同规范：24 画布、描边、r ≤ 1 实心） */
function Glyph({ name, x, y, s, color, flip }: { name: string; x: number; y: number; s: number; color: string; flip?: boolean }) {
  const ic = RETRO_ICONS[name] ?? RETRO_ICONS.misc!
  const t = flip ? `translate(${x + 24 * s} ${y}) scale(${-s} ${s})` : `translate(${x} ${y}) scale(${s})`
  return (
    <G transform={t} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {ic.paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
      {ic.circles?.map((c, i) => <Circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={c.r <= 1 ? color : 'none'} />)}
    </G>
  )
}

/** 回纹带：沿内框上下各一条 */
function huiwen(y: number, flip: boolean) {
  let d = ''
  for (let x = 26; x <= 286; x += 13) {
    d += flip ? `M${x} ${y - 6}v6h9v-6h-5v3` : `M${x} ${y + 6}v-6h9v6h-5v-3`
  }
  return d
}

/** 简化的龙：S 形龙身 + 龙首 + 鳞纹，线描 */
const DRAGON = [
  'M14 150c10-14 0-30 12-44s26-8 30-22-6-26 8-36',
  'M64 48c6-4 14-2 16 4s-4 10-10 9',
  'M66 46l-4-8M72 44l2-9',
  'M70 58c4 2 9 1 12-2',
  'M24 128l6 3M30 112l6 2M44 98l5 4M52 82l6 1',
  'M14 150c-2 6 2 10 8 8',
]

function Ornaments({ tier, look }: { tier: PlaqueTier; look: Look }) {
  const c = look.accent
  switch (tier) {
    case 'copper':
      return (
        <>
          {/* 木纹 */}
          <Path d="M10 9h300M10 191h300M9 12v176M311 12v176" stroke={look.frameLine} strokeWidth={0.8} opacity={0.5} />
          {/* 四角铜钱 */}
          <Glyph name="coin" x={22} y={22} s={1} color={c} />
          <Glyph name="coin" x={274} y={22} s={1} color={c} />
          <Glyph name="coin" x={22} y={154} s={1} color={c} />
          <Glyph name="coin" x={274} y={154} s={1} color={c} />
        </>
      )
    case 'silver':
      return (
        <>
          {/* 四角祥云 */}
          <Glyph name="misc" x={20} y={20} s={1.3} color={c} />
          <Glyph name="misc" x={269} y={20} s={1.3} color={c} flip />
          <Glyph name="misc" x={20} y={150} s={1.3} color={c} />
          <Glyph name="misc" x={269} y={150} s={1.3} color={c} flip />
        </>
      )
    case 'gold':
      return <Path d={huiwen(24, false) + huiwen(176, true)} stroke={c} strokeWidth={1.4} fill="none" strokeLinejoin="round" />
    case 'jade':
      return (
        <>
          <G stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {DRAGON.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </G>
          <G transform={`translate(${W} 0) scale(-1 1)`} stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {DRAGON.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </G>
        </>
      )
    case 'jubao':
      return (
        <>
          <Path d={huiwen(24, false) + huiwen(176, true)} stroke={c} strokeWidth={1.2} fill="none" strokeLinejoin="round" opacity={0.7} />
          <Glyph name="treasure-bowl" x={142} y={30} s={1.5} color={c} />
          <Glyph name="ingot" x={30} y={86} s={1.2} color={c} />
          <Glyph name="ingot" x={262} y={86} s={1.2} color={c} />
        </>
      )
  }
}

/** 聚宝盆的流光：一道斜光缓慢扫过（系统开了减弱动态效果时不动） */
function Shimmer({ width, height }: { width: number; height: number }) {
  const reduce = useReducedMotion()
  const x = useSharedValue(-width)
  useEffect(() => {
    if (reduce) return
    x.value = withRepeat(withDelay(1200, withTiming(width * 1.4, { duration: 2400, easing: Easing.inOut(Easing.quad) })), -1, false)
  }, [reduce, width, x])
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: '20deg' }] }))
  if (reduce) return null
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -height * 0.3, width: width * 0.3, height: height * 1.6 }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="sh" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#FFF4C8" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sh)" />
      </Svg>
    </Animated.View>
  )
}

export interface PlaqueProps {
  tier: PlaqueTier
  /** reached：攒够了待圆梦（淡一点、没有印章）；fulfilled：盖上圆梦印章 */
  stage: PlaqueStage
  /** 待圆梦时是否变淡（圆梦页盖章动画时不变淡） */
  dimPending?: boolean
  name: string
  amount: string // 已格式化，如 "¥20,000"
  duration: string // "三月成"
  date: string // "2026.11.18"
  width: number
}

/** 如愿匾：金额越大越气派 */
export function Plaque({ tier, stage, dimPending = true, name, amount, duration, date, width }: PlaqueProps) {
  const look = LOOKS[tier]
  const k = width / W
  const height = H * k
  return (
    <View
      accessible
      accessibilityLabel={`${name}，${amount}，${duration}`}
      style={{ width, height, borderRadius: 10 * k, overflow: 'hidden' }}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={`f-${tier}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={look.frame[0]} />
            <Stop offset="1" stopColor={look.frame[1]} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} rx={10} fill={`url(#f-${tier})`} />
        <Rect x={3} y={3} width={W - 6} height={H - 6} rx={8} fill="none" stroke={look.frameLine} strokeWidth={1} opacity={0.6} />
        <Rect x={14} y={14} width={W - 28} height={H - 28} rx={4} fill={look.panel} stroke={look.frameLine} strokeWidth={1.2} />
        <Rect x={18} y={18} width={W - 36} height={H - 36} rx={2} fill="none" stroke={look.accent} strokeWidth={0.8} opacity={0.6} />
        <Ornaments tier={tier} look={look} />
      </Svg>

      {tier === 'jubao' ? <Shimmer width={width} height={height} /> : null}

      {/* 文字：目标名（大）、金额、用时与日期 */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44 * k, paddingTop: tier === 'jubao' ? 22 * k : 0 }}>
        <Txt
          v="title"
          numberOfLines={1}
          adjustsFontSizeToFit
          allowFontScaling={false}
          style={{ fontSize: 30 * k, lineHeight: 38 * k, color: look.text, letterSpacing: 4 * k }}
        >
          {name}
        </Txt>
        <Txt v="h2" allowFontScaling={false} style={{ fontSize: 17 * k, lineHeight: 24 * k, color: look.text }}>
          {amount}
        </Txt>
        <Txt v="caption" allowFontScaling={false} style={{ fontSize: 11 * k, lineHeight: 15 * k, color: look.sub, marginTop: 4 * k }}>
          {duration} · {date}
        </Txt>
      </View>

      {stage === 'fulfilled' ? (
        <View style={{ position: 'absolute', ...sealBox(width) }}>
          <PlaqueSeal size={sealBox(width).width} seed={name + date} />
        </View>
      ) : dimPending ? (
        <>
          {/* 攒够了、还没圆梦：淡一点，角上写“待圆梦” */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,253,248,0.35)' }} />
          <View style={{ position: 'absolute', right: 22 * k, top: 22 * k, paddingHorizontal: 6 * k, borderRadius: 3 * k, backgroundColor: 'rgba(43,33,24,0.55)' }}>
            <Txt v="caption" allowFontScaling={false} style={{ fontSize: 10 * k, lineHeight: 15 * k, color: colors.white }}>
              待圆梦
            </Txt>
          </View>
        </>
      ) : null}
    </View>
  )
}

/** 已达成的目标 → 牌匾内容（档位按目标金额，金额写目标数） */
export function plaqueOf(g: Goal): Omit<PlaqueProps, 'width'> {
  const on = g.achievedOn ?? g.createdOn
  return {
    tier: tierOf(g.targetCents),
    stage: g.fulfilledOn ? 'fulfilled' : 'reached',
    name: g.name,
    amount: formatYuan(g.targetCents),
    duration: durationLabel(g.createdOn, on),
    date: on.replace(/-/g, '.'),
  }
}

/** 落款印章在牌匾上的位置（右下角），圆梦页盖章动画用同一个位置 */
export function sealBox(width: number) {
  const k = width / W
  return { right: 28 * k, bottom: 22 * k, width: 34 * k, height: 34 * k }
}

/** 圆梦印章：白文方印，印文“不负韶华”（utils/seal），微斜；seed 用匾名和日期，每块匾的斑驳不一样 */
export function PlaqueSeal({ size, seed }: { size: number; seed: string }) {
  return (
    <View style={{ transform: [{ rotate: '-3deg' }] }}>
      <Seal char={SEAL_PHRASE} px={size} filled seed={seed} />
    </View>
  )
}
