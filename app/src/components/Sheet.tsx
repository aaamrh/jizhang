import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radius, shadowRaised, size, space } from '../theme'
import { SPRING } from './motion'
import { Txt } from './Txt'

// 可拖动面板的高度档位（占屏幕高度）：半屏、全屏；拖到低于 CLOSE 松手即关闭
const HALF = 0.55
const FULL = 0.92
const MIN = 0.3
const CLOSE = 0.42

/** 拖动条 */
function Grip() {
  return (
    <View style={{ alignItems: 'center', paddingTop: space.xs }}>
      <View style={{ width: space.xxl, height: space.xxs, borderRadius: radius.pill, backgroundColor: colors.hair }} />
    </View>
  )
}

/**
 * 底部弹出面板：上圆角 20、拖拽条、可选标题；点遮罩关闭。
 * expandable：先半屏打开，按住顶部上拉到全屏、下拉关闭（明细列表这类长内容用）
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  scroll = true,
  expandable,
}: {
  visible: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  scroll?: boolean
  expandable?: boolean
}) {
  const { height: screenH } = useWindowDimensions()
  const h = useSharedValue(screenH * HALF)
  const start = useSharedValue(0)
  useEffect(() => {
    if (visible) h.value = screenH * HALF
  }, [visible, screenH, h])

  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = h.value
    })
    .onUpdate((e) => {
      h.value = Math.min(screenH * FULL, Math.max(screenH * MIN, start.value - e.translationY))
    })
    .onEnd((e) => {
      if (h.value < screenH * CLOSE || e.velocityY > 1200) {
        runOnJS(onClose)()
        return
      }
      const target = e.velocityY < -600 || h.value > screenH * ((HALF + FULL) / 2) ? FULL : HALF
      h.value = withSpring(screenH * target, SPRING)
    })
  const heightStyle = useAnimatedStyle(() => ({ height: h.value }))

  const header = (
    <>
      <Grip />
      {title ? (
        <Txt v="h2" center numberOfLines={1} style={{ paddingVertical: space.sm, paddingHorizontal: space.lg }}>
          {title}
        </Txt>
      ) : (
        <View style={{ height: space.sm }} />
      )}
    </>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* keyboard-controller 把 Modal 窗口设成不随键盘调整，面板里有输入框时要自己让出键盘高度，否则整块被输入法盖住 */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="关闭" />
          <SafeAreaView
            edges={['bottom']}
            style={[{ backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet }, shadowRaised]}
          >
            {expandable ? (
              <Animated.View style={heightStyle}>
                <GestureDetector gesture={pan}>
                  <View accessibilityHint="上拉展开，下拉关闭">{header}</View>
                </GestureDetector>
                <ScrollView style={{ flex: 1 }}>{children}</ScrollView>
              </Animated.View>
            ) : (
              <>
                {header}
                {scroll ? <ScrollView style={{ maxHeight: size.sheetMax }}>{children}</ScrollView> : children}
              </>
            )}
            <View style={{ height: space.xs }} />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  )
}
