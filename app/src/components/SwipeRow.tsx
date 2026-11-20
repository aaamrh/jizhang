import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { colors, size } from '../theme'
import { Txt } from './Txt'

const W = size.swipeAction
const EASE = { duration: 200 }
/** 手指先水平移动这么多才算左滑 */
const SWIPE_X = 16
/** 先竖着移动了这么多，这一下就交给列表（滚动、下拉刷新），左滑作废 */
const GIVE_UP_Y = 10

/**
 * 左滑露出红色“删除”（列表通用：流水、搜索、盘账明细、常记）。点删除先收回再回调，由调用方确认；没有 onDelete 时不能左滑。
 * 以前用 ReanimatedSwipeable：它只看水平距离，斜着下拉时会抢走列表的手势，刷新转圈停在半路；
 * 刷新时再禁用它，拉开一半的行又收不回去。这里先竖着动就放弃，两个手势不会同时进行，也就不用在刷新时禁用。
 */
export function SwipeRow({ children, onDelete, label = '删除' }: { children: ReactNode; onDelete?: () => void; label?: string }) {
  const x = useSharedValue(0)
  const start = useSharedValue(0)
  const [open, setOpen] = useState(false)
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  if (!onDelete) return <>{children}</>

  const pan = Gesture.Pan()
    .activeOffsetX([-SWIPE_X, SWIPE_X])
    .failOffsetY([-GIVE_UP_Y, GIVE_UP_Y])
    .onStart(() => {
      start.value = x.value
    })
    .onUpdate((e) => {
      x.value = Math.min(0, Math.max(-W, start.value + e.translationX))
    })
    .onEnd((e) => {
      const toOpen = e.velocityX < -500 || (e.velocityX <= 500 && x.value < -W / 2)
      x.value = withTiming(toOpen ? -W : 0, EASE)
      runOnJS(setOpen)(toOpen)
    })
  // 打开时点一下行本身是收回，不是打开那笔账
  const tap = Gesture.Tap()
    .enabled(open)
    .onEnd(() => {
      x.value = withTiming(0, EASE)
      runOnJS(setOpen)(false)
    })

  return (
    <GestureDetector gesture={pan}>
      <View style={{ overflow: 'hidden' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => {
            x.value = withTiming(0, EASE)
            setOpen(false)
            onDelete()
          }}
          style={({ pressed }) => [
            StyleSheet.absoluteFill,
            { left: undefined, width: W, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.seal, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Txt v="small" color={colors.white} medium>
            {label}
          </Txt>
        </Pressable>
        <GestureDetector gesture={tap}>
          {/* 行本身透明时，删除按钮会透出来，所以给行一层底色 */}
          <Animated.View pointerEvents={open ? 'box-only' : 'auto'} style={[{ backgroundColor: colors.surface }, rowStyle]}>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureDetector>
  )
}
