import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

// 动效统一在这里定义：克制、短促，系统开启“减弱动态效果”时全部退化为直接切换

/**
 * 底部面板升起（记一笔的金额面板）：150ms 缓出，点完分类马上能按键盘。
 * 以前用弹簧（damping 22 / stiffness 220）要 400ms 以上才停稳，记账时明显拖沓
 */
export const panelIn = SlideInDown.duration(150).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)
/** 列表项进出、位置变化 */
export const itemIn = FadeIn.duration(180).reduceMotion(ReduceMotion.System)
export const itemOut = FadeOut.duration(140).reduceMotion(ReduceMotion.System)
export const itemLayout = LinearTransition.duration(200).reduceMotion(ReduceMotion.System)
/** 开关打开后在下面展开的设置行（如提醒时间）：从上一行里滑出来，关掉时收回去；下面的行用 itemLayout 跟着让位 */
export const rowReveal = FadeInUp.duration(220).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)
export const rowHide = FadeOutUp.duration(160).reduceMotion(ReduceMotion.System)

export const SPRING = { damping: 20, stiffness: 260, mass: 0.6 } as const

/**
 * 盖章：从天而降。章从 STAMP_FROM 倍大（离眼睛近）开始，越落越快（先慢后快，像有重量），落到纸面就停住、不回弹；
 * 落地那一刻（STAMP_PRESS.duration 之后）手机轻震一下。
 */
export const STAMP_FROM = 2.4
export const STAMP_PRESS = { duration: 280, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.System }
/** 落地时轻震一下，像“啪”地盖上 */
export const stampThud = () => setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), STAMP_PRESS.duration)
/** 入账章停一会儿后慢慢淡掉 */
export const STAMP_HOLD_MS = 500
export const STAMP_FADE = { duration: 400, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.System } // 用户嫌淡得慢：0.9 秒 → 0.4 秒

/** 按下微缩：卡片、记账按钮 */
export function PressScale({
  children,
  style,
  scaleTo = 0.96,
  ...rest
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const reduce = useReducedMotion()
  const s = useSharedValue(1)
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }))
  const to = (v: number) => {
    if (!reduce) s.value = withSpring(v, SPRING)
  }
  return (
    <Pressable {...rest} onPressIn={(e) => (to(scaleTo), rest.onPressIn?.(e))} onPressOut={(e) => (to(1), rest.onPressOut?.(e))}>
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  )
}

/** 数字滚动到新值（首页、统计的合计）；减弱动态效果时直接显示 */
export function useCountUp(target: number, duration = 420) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (reduce || from.current === target) {
      from.current = target
      setShown(target)
      return
    }
    const start = from.current
    const t0 = Date.now()
    let raf = 0
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(start + (target - start) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = target
    }
  }, [target, duration, reduce])
  return shown
}
