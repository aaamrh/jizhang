import { useEffect, type ReactNode } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg'
import { colors, flameColors, radius } from '../theme'
import type { FlameLevel } from '../utils/streak'

/**
 * 每档的样子：大小、快慢（节奏倍数，1 = 原动画的节奏）、动作幅度、冒几颗火星。
 * 天数越多火越旺：越大、越快、动得越多、火星越多。
 */
const LOOK: Record<FlameLevel, { scale: number; tempo: number; amp: number; sparks: number }> = {
  0: { scale: 0.86, tempo: 1, amp: 0, sparks: 0 },
  1: { scale: 0.9, tempo: 1.15, amp: 0.7, sparks: 1 },
  2: { scale: 0.95, tempo: 1, amp: 0.85, sparks: 1 },
  3: { scale: 1, tempo: 0.92, amp: 1, sparks: 2 },
  4: { scale: 1.03, tempo: 0.85, amp: 1.1, sparks: 3 },
  5: { scale: 1.06, tempo: 0.78, amp: 1.2, sparks: 3 },
}

// ── 形状：一比一照搬经典的 CSS 火焰（四个正方形，圆角 0 40% 60% 40%，旋转 45°、横向压到 0.8）──
// CSS 里容器是 100×100，左右两团伸出容器外，所以画布取 (-27, -40) 起、边长 159，四周留出光晕和火星的位置
const VB = { x: -27, y: -40, size: 159 }
/** 正方形，左上角尖、其余三个角按 CSS 规则取圆（圆角之和超过边长时等比缩小） */
const rounded = (s: number, tr: number, br: number, bl: number) => {
  const f = Math.min(1, s / (tr + br), s / (br + bl))
  const [a, b, c] = [tr * f, br * f, bl * f]
  return `M0 0H${s - a}A${a} ${a} 0 0 1 ${s} ${a}V${s - b}A${b} ${b} 0 0 1 ${s - b} ${s}H${c}A${c} ${c} 0 0 1 0 ${s - c}Z`
}
/** CSS 的 transform: scaleX(.8) rotate(45deg)，以元素自己的中心为轴 */
const tilt = (x: number, y: number, s: number) => `translate(${x + s / 2} ${y + s / 2}) scale(0.8 1) rotate(45) translate(${-s / 2} ${-s / 2})`
const SHAPES = {
  center: { d: rounded(100, 40, 60, 40), t: tilt(0, 0, 100) }, // .fire-center .main-fire：100%，在原位
  left: { d: rounded(80, 32, 48, 32), t: tilt(-20, 15, 80) }, // .fire-left：top 15%、left -20%、80%
  right: { d: rounded(80, 32, 48, 32), t: tilt(45, 15, 80) }, // .fire-right：top 15%、right -25%、80%
  glow: { d: rounded(75, 30, 75, 30), t: tilt(20, 30, 75) }, // .fire-bottom：top 30%、left 20%、75%，圆角 0 40% 100% 40%
}
/** CSS 动画以 100×100 容器的中心 (50, 50) 为轴，换算成这块画布上的百分比 */
const ORIGIN = `${((50 - VB.x) / VB.size) * 100}% ${((50 - VB.y) / VB.size) * 100}%`
// 火星：.particle-fire 的起点（容器坐标）、半径、往上飘多远、一轮多久
const SPARKS = [
  { x: 50, y: 65, r: 5, rise: 95, ms: 2000, delay: 0 }, // 中间那团的
  { x: 57.5, y: 52.5, r: 7, rise: 85, ms: 2000, delay: 900 }, // 右边那团的
  { x: 25, y: 15, r: 5, rise: 70, ms: 3000, delay: 400 }, // 左边那团的
]

/** 0 → 1 一直循环（不往回走），时长 ms */
function useLoop(ms: number, run: boolean, delay = 0) {
  const t = useSharedValue(0)
  useEffect(() => {
    if (!run) return
    t.value = 0
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: ms, easing: Easing.linear, reduceMotion: ReduceMotion.System }), -1, false))
  }, [ms, run, delay, t])
  return t
}

/** CSS 的 ease-out（cubic-bezier(0, 0, .58, 1)），用在每两个关键帧之间 */
const easeOut = (x: number) => {
  'worklet'
  return 1 - (1 - x) * (1 - x) * (1 - x * 0.42)
}

/**
 * 连续记账的火苗（SVG + Reanimated），一比一照搬经典的 CSS 火焰动画：
 * - 中间一大团（径向渐变，深到浅）3 秒一轮：50% 长高 10%、75% 矮 5%、80% 收窄 5%、90% 又长高；
 * - 左右两团分别按 3 秒、2 秒：50% 时歪 5°、缩到 0.9，再回来；
 * - 底部一团亮光（CSS 里是模糊的）2 秒一明一暗；每团火外面一圈光晕（CSS 的 drop-shadow）；
 * - 火星从各团火里往上飘，到顶变小、淡掉。
 * 几路节奏互不整除，看起来不会整齐地重复。0 档（今天还没记）是灰的、不动，上面飘一缕烟。系统开了“减弱动态效果”时静止。
 */
export function Flame({ level, px = 18 }: { level: FlameLevel; px?: number }) {
  const look = LOOK[level]
  const [deep, mid, light] = flameColors[level]
  const reduce = useReducedMotion()
  const run = !reduce && level > 0
  const k = look.amp
  const T = (ms: number) => Math.round(ms * look.tempo)
  const c = useLoop(T(3000), run)
  const l = useLoop(T(3000), run)
  const r = useLoop(T(2000), run)
  const g = useLoop(T(2000), run)

  // @keyframes scaleUpDown：0%,100% 原样；50%,90% scaleY 1.1；75% scaleY .95；80% scaleX .95
  const centerStyle = useAnimatedStyle(() => {
    const t = c.value
    const seg = (a: number, b: number, from: number, to: number) => from + (to - from) * easeOut((t - a) / (b - a))
    let sy = 1
    let sx = 1
    if (t < 0.5) sy = seg(0, 0.5, 1, 1.1)
    else if (t < 0.75) sy = seg(0.5, 0.75, 1.1, 0.95)
    else if (t < 0.8) {
      sy = seg(0.75, 0.8, 0.95, 1)
      sx = seg(0.75, 0.8, 1, 0.95)
    } else if (t < 0.9) {
      sy = seg(0.8, 0.9, 1, 1.1)
      sx = seg(0.8, 0.9, 0.95, 1)
    } else sy = seg(0.9, 1, 1.1, 1)
    return { transform: [{ scaleX: 1 + k * (sx - 1) }, { scaleY: 1 + k * (sy - 1) }] }
  })
  // @keyframes shake：0%,100% 原样；50% skewX(5deg) scale(.9)
  const shake = (t: number) => {
    'worklet'
    const p = t < 0.5 ? easeOut(t * 2) : 1 - easeOut((t - 0.5) * 2)
    return { transform: [{ skewX: `${k * 5 * p}deg` }, { scale: 1 - k * 0.1 * p }] }
  }
  const leftStyle = useAnimatedStyle(() => shake(l.value))
  const rightStyle = useAnimatedStyle(() => shake(r.value))
  // @keyframes glow：亮光在中间色和浅色之间来回
  const glowStyle = useAnimatedStyle(() => ({ opacity: Math.sin(g.value * Math.PI) }))

  const layer = (children: ReactNode, style?: ReturnType<typeof useAnimatedStyle>) => (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: px, height: px, transformOrigin: ORIGIN }, style]}>
      <Svg width={px} height={px} viewBox={`${VB.x} ${VB.y} ${VB.size} ${VB.size}`}>
        {children}
      </Svg>
    </Animated.View>
  )
  const shape = (key: keyof typeof SHAPES, fill: string) => <Path d={SHAPES[key].d} transform={SHAPES[key].t} fill={fill} />
  return (
    <View style={{ width: px, height: px }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: px, height: px, transform: [{ scale: look.scale }] }}>
        {/* 光晕（CSS 的 drop-shadow）：每团火外面一圈，渐隐 */}
        {level > 0
          ? layer(
              <>
                <Defs>
                  <RadialGradient id="flameHalo" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={deep} stopOpacity={0.55} />
                    <Stop offset="0.55" stopColor={deep} stopOpacity={0.28} />
                    <Stop offset="1" stopColor={deep} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={52} cy={48} rx={88} ry={80} fill="url(#flameHalo)" />
              </>,
            )
          : null}
        {layer(shape('left', mid), leftStyle)}
        {layer(
          <>
            <Defs>
              {/* radial-gradient(farthest-corner at 10px 0, 深 0%, 中 95%)：正方形左上角（旋转后是火尖）最深 */}
              <RadialGradient id="flameCore" cx="10%" cy="0%" r="140%" fx="10%" fy="0%">
                <Stop offset="0" stopColor={deep} />
                <Stop offset="0.95" stopColor={mid} />
              </RadialGradient>
            </Defs>
            <Path d={SHAPES.center.d} transform={SHAPES.center.t} fill="url(#flameCore)" />
          </>,
          centerStyle,
        )}
        {layer(shape('right', mid), rightStyle)}
        {/* 底部亮光：CSS 里是模糊的，这里用渐隐代替；中间色打底，浅色一明一暗 */}
        {layer(
          <>
            <Defs>
              <RadialGradient id="flameGlowMid" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={mid} stopOpacity={0.9} />
                <Stop offset="1" stopColor={mid} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={57} cy={70} rx={36} ry={30} fill="url(#flameGlowMid)" />
          </>,
        )}
        {layer(
          <>
            <Defs>
              <RadialGradient id="flameGlowLight" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={light} stopOpacity={0.85} />
                <Stop offset="0.6" stopColor={light} stopOpacity={0.35} />
                <Stop offset="1" stopColor={light} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={57} cy={70} rx={32} ry={26} fill="url(#flameGlowLight)" />
          </>,
          run ? glowStyle : undefined,
        )}
      </View>
      {run ? SPARKS.slice(0, look.sparks).map((sp, i) => <Spark key={i} px={px} sp={sp} tempo={look.tempo} color={mid} glow={deep} />) : null}
      {level === 0 && !reduce ? <Smoke px={px} /> : null}
    </View>
  )
}

/** 一颗火星（@keyframes particleUp）：20% 显出来，到顶变成一半大、淡掉，循环 */
function Spark({ px, sp, tempo, color, glow }: { px: number; sp: (typeof SPARKS)[number]; tempo: number; color: string; glow: string }) {
  const v = useLoop(Math.round(sp.ms * tempo), true, Math.round(sp.delay * tempo))
  const u = px / VB.size // 画布单位 → 像素
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
    transform: [{ translateY: -sp.rise * u * easeOut(v.value) }, { scale: 1 - 0.5 * v.value }],
  }))
  const d = Math.max(2, sp.r * 2 * u)
  return (
    <Animated.View
      style={[{ position: 'absolute', left: (sp.x - VB.x) * u - d / 2, top: (sp.y - VB.y) * u - d / 2, width: d, height: d, borderRadius: radius.pill, backgroundColor: color, boxShadow: `0px 0px ${d}px ${glow}` }, style]}
    />
  )
}

/** 灰火星上飘的一缕烟 */
function Smoke({ px }: { px: number }) {
  const v = useLoop(3200, true)
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.2, 1], [0, 0.5, 0]),
    transform: [{ translateX: -px * 0.05 * v.value }, { translateY: -px * 0.3 * v.value }],
  }))
  return (
    <Animated.View style={[{ position: 'absolute', left: px * 0.42, top: -px * 0.05 }, style]}>
      <Svg width={px * 0.2} height={px * 0.3} viewBox="0 0 4 6">
        <Path d="M2 .5c-1 1.2 1 2 0 3.3" fill="none" stroke={colors.ink3} strokeWidth={0.9} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  )
}
