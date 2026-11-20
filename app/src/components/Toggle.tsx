import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import Animated, { interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { coin as coinColor, colors, radius, shadow, size } from '../theme'

/**
 * 开关：素面圆角底，圆钮是一枚黄铜方孔钱（外廓、方孔、孔边内廓，方孔透出底色）。
 * 关 = 浅灰底、钱在左；开 = 墨色底、钱滚到右边，方孔跟着转（转角 = 滚过的距离 / 周长）。
 * 乐观更新：点下去立刻动，onChange 返回 false（比如没给通知权限）或抛错再弹回去。
 */
const W = size.toggleW
const H = size.toggleH
const PAD = 3
const KNOB = H - PAD * 2
const TRAVEL = W - KNOB - PAD * 2
const ROLL_DEG = (TRAVEL / (Math.PI * KNOB)) * 360
const timing = { duration: 220, reduceMotion: ReduceMotion.System }

export function Toggle({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean
  onChange: (v: boolean) => void | boolean | Promise<void | boolean>
  label: string
  disabled?: boolean
}) {
  const [on, setOn] = useState(value)
  useEffect(() => setOn(value), [value])
  const p = useSharedValue(value ? 1 : 0)
  useEffect(() => {
    p.value = withTiming(on ? 1 : 0, timing)
  }, [on, p])
  // 关着：宣纸底 + 一道细边（原来是灰褐底，用户嫌发灰）；开着：墨底
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.fill, colors.active]),
    borderColor: interpolateColor(p.value, [0, 1], [colors.toggleRim, colors.active]),
  }))
  const hole = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [colors.fill, colors.active]) })) // 方孔透出底色
  const coin = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * TRAVEL }, { rotate: `${p.value * ROLL_DEG}deg` }] }))

  const press = async () => {
    const next = !on
    setOn(next)
    Haptics.selectionAsync().catch(() => {})
    try {
      const ok = await onChange(next)
      if (ok === false) setOn(!next)
    } catch {
      setOn(!next)
    }
  }

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={press}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View style={[{ width: W, height: H, borderRadius: radius.pill, padding: PAD - 1, borderWidth: 1 }, track]}>
        <Animated.View style={[{ width: KNOB, height: KNOB, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }, shadow, coin]}>
          {/* 钱面 + 外廓（边上一道深色，里面再一道细线，像铸出来的凸边） */}
          <Svg width={KNOB} height={KNOB} viewBox="0 0 24 24" style={{ position: 'absolute' }}>
            <Circle cx={12} cy={12} r={11.4} fill={coinColor.face} stroke={coinColor.rim} strokeWidth={1.2} />
            <Circle cx={12} cy={12} r={9.2} fill="none" stroke={coinColor.rim} strokeOpacity={0.5} strokeWidth={0.7} />
          </Svg>
          {/* 方孔透出底色，孔边一圈内廓 */}
          <Animated.View style={[{ width: KNOB * 0.3, height: KNOB * 0.3, borderWidth: 1, borderColor: coinColor.rim }, hole]} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}
