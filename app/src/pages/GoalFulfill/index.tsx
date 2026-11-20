import { useEffect, useRef, useState } from 'react'
import { Image, useWindowDimensions, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { Button } from '../../components/Button'
import { STAMP_FROM, STAMP_PRESS, stampThud } from '../../components/motion'
import { attempt } from '../../components/dialogs'
import { Plaque, plaqueOf, PlaqueSeal, sealBox } from '../../components/Plaque'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { goalActions } from '../../hooks/actions'
import { useGoals } from '../../hooks/data'
import { discardPhoto, pickPhoto } from '../../hooks/photo'
import { useAuth } from '../../store/authStore'
import { useUi } from '../../store/uiStore'
import { GUTTER, radius, space } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { goalCopy } from '../../utils/goals'

/** 圆梦：攒够的钱用在了想做的事上。写一句话、配一张照片（都可不填），盖上“圆梦”印 */
export default function GoalFulfillPage({ navigation, route }: StackProps<'GoalFulfill'>) {
  const goal = useGoals().find((g) => g.id === route.params.id)
  const { width } = useWindowDimensions()
  const reduce = useReducedMotion()
  const [wish, setWish] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const loggedIn = useAuth((s) => !!s.token && !!s.syncConsent)
  const [stamped, setStamped] = useState(false)
  const saved = useRef(false)
  // 印章：从天而降，落到牌匾上就停住、轻震一下，不回弹（不晕开红圈，红色只留在印上）
  const sealScale = useSharedValue(STAMP_FROM)
  const sealOpacity = useSharedValue(0)
  const sealStyle = useAnimatedStyle(() => ({ opacity: sealOpacity.value, transform: [{ scale: sealScale.value }] }))

  // 没盖章就离开：刚拍的照片删掉，不留垃圾
  useEffect(() => () => void (!saved.current && discardPhoto(photo)), [photo])

  if (!goal) return null
  const plaqueW = width - GUTTER * 2
  const plaque = plaqueOf(goal)
  const box = sealBox(plaqueW)

  const choose = async (source: 'camera' | 'library') => {
    const uri = await pickPhoto(`goal-${goal.id}`, source)
    if (!uri) return
    discardPhoto(photo)
    setPhoto(uri)
  }

  const stamp = () => {
    if (!attempt(() => goalActions.fulfill(goal.id, { wish, photo }))) return
    saved.current = true
    setStamped(true)
    if (reduce) {
      sealScale.value = 1
      sealOpacity.value = 1
    } else {
      sealOpacity.value = withTiming(1, { duration: 120 })
      sealScale.value = withTiming(1, STAMP_PRESS)
      stampThud()
    }
    useUi.getState().showVerse(goalCopy('fulfilled'))
    setTimeout(() => navigation.goBack(), reduce ? 900 : 1600)
  }

  return (
    <Screen footer={<Button title={stamped ? '圆梦了' : '盖章圆梦'} variant="primary" disabled={stamped || !!goal.fulfilledOn} onPress={stamp} />}>
      <View>
        <Plaque {...plaque} stage="reached" dimPending={false} width={plaqueW} />
        <View pointerEvents="none" style={{ position: 'absolute', ...box, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={sealStyle}>
            <PlaqueSeal size={box.width} seed={plaque.name + plaque.date} />
          </Animated.View>
        </View>
      </View>

      <Txt muted center>
        攒钱是为了好好生活。钱用在了「{goal.name}」上，就盖上这枚印吧。
      </Txt>

      <Section plain>
        <TextField label="说一句（选填）" value={wish} onChangeText={setWish} placeholder="比如：海风很好，下次还来" maxLength={40} editable={!stamped} />
      </Section>

      <Section title={loggedIn ? '配一张照片（选填，会同步到你的账号）' : '配一张照片（选填，登录后可同步）'} plain>
        {photo ? (
          <Image source={{ uri: photo }} resizeMode="cover" style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md }} accessibilityIgnoresInvertColors />
        ) : null}
        {stamped ? null : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="拍一张" size="md" onPress={() => void choose('camera')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="从相册选" size="md" onPress={() => void choose('library')} />
            </View>
          </View>
        )}
      </Section>
    </Screen>
  )
}
