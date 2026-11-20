import { useEffect, useMemo } from 'react'
import { Modal, useWindowDimensions, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { navigationRef } from '../navigation/ref'
import { useUi } from '../store/uiStore'
import { colors, GUTTER, space } from '../theme'
import type { Goal } from '../types/domain'
import { goalCopy, tierName, tierOf } from '../utils/goals'
import { Button } from './Button'
import { Plaque, plaqueOf } from './Plaque'
import { Txt } from './Txt'
import { VerseBlock } from './Verse'

/**
 * 攒钱目标的两个时刻：
 * - reached：第一次存满，牌匾从中间落下（还没盖章），提醒“攒钱是为了好好生活”，可以直接去圆梦；
 * - withdrawn：攒够后从储钱罐取钱，轻轻问一句是不是去圆梦
 */
export function GoalCelebration({ goals }: { goals: Goal[] }) {
  const c = useUi((s) => s.celebrate)
  const close = useUi((s) => s.setCelebrate)
  const { width } = useWindowDimensions()
  const reduce = useReducedMotion()
  const scale = useSharedValue(0.6)
  const opacity = useSharedValue(0)
  const goal = goals.find((g) => g.id === c?.goalId)
  // 每次弹出取一句，重绘时不变
  const verse = useMemo(() => goalCopy('reached'), [c?.goalId])

  useEffect(() => {
    if (!goal) return
    if (reduce) {
      scale.value = 1
      opacity.value = 1
      return
    }
    scale.value = 0.6
    opacity.value = 0
    opacity.value = withTiming(1, { duration: 220 })
    scale.value = withDelay(80, withSpring(1, { damping: 11, stiffness: 140 }))
  }, [goal, reduce, scale, opacity])
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }))

  if (!goal || !c) return null
  const reached = c.mode === 'reached'
  const fulfill = () => {
    close(null)
    if (navigationRef.isReady()) navigationRef.navigate('GoalFulfill', { id: goal.id })
  }
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => close(null)}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: GUTTER, gap: space.lg }}>
        <Txt v="display" color={colors.white} center>
          {reached ? '攒够了' : '要去圆梦了吗'}
        </Txt>
        <Animated.View style={anim}>
          <Plaque {...plaqueOf(goal)} dimPending={false} width={width - GUTTER * 2} />
        </Animated.View>
        {reached ? <VerseBlock v={verse} light /> : null}
        <Txt v="small" color={colors.white} center>
          {reached
            ? `「${goal.name}」的${tierName(tierOf(goal.targetCents))}匾挂上了，去实现它，再盖一枚“圆梦”印`
            : `钱取出来了，是去实现「${goal.name}」吗？圆梦后，牌匾会盖上一枚“圆梦”印`}
        </Txt>
        <View style={{ flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' }}>
          <View style={{ flex: 1 }}>
            <Button title={reached ? '先收着' : '还没呢'} onPress={() => close(null)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={reached ? '去圆梦' : '圆梦'} variant="primary" onPress={fulfill} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
