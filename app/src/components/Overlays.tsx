import { useEffect, useState } from 'react'
import { showAlert } from './dialogs'
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeOut, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import { SPRING, STAMP_FADE, STAMP_FROM, STAMP_HOLD_MS, STAMP_PRESS, stampThud } from './motion'
import { Sheet } from './Sheet'
import { authenticate } from '../hooks/useAppLock'
import { useSettings } from '../store/settingsStore'
import { useUi, type DialogButton } from '../store/uiStore'
import { colors, GUTTER, radius, shadowRaised, size, space } from '../theme'
import { Button } from './Button'
import { DateField } from './DateField'
import { ListRow } from './ListRow'
import { ENTRY_STAMP } from '../utils/seal'
import { Seal } from './Seal'
import { Txt } from './Txt'
import { VerseBlock } from './Verse'
import { Flame } from './Flame'
import { itemIn, itemOut } from './motion'
import { flameLevel } from '../utils/streak'

/** 应用锁：盖住整个界面，出现时自动弹出系统验证 */
export function LockOverlay() {
  const locked = useUi((s) => s.locked)
  const setLocked = useUi((s) => s.setLocked)
  const unlock = async () => {
    if (await authenticate()) setLocked(false)
  }
  useEffect(() => {
    if (locked) void unlock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked])
  if (!locked) return null
  return (
    <View style={[StyleSheet.absoluteFill, s.lock]}>
      <Seal char="账" px={size.sealLg} filled />
      <Txt v="title">账房已上锁</Txt>
      <Button title="解锁" variant="primary" onPress={unlock} />
    </View>
  )
}

/** 版本更新：可选更新可以关闭；强制更新不能关闭 */
export function UpdateDialog() {
  const update = useUi((s) => s.update)
  const setUpdate = useUi((s) => s.setUpdate)
  if (!update || update.update === 'none') return null
  const force = update.update === 'force'
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => {
        if (!force) setUpdate(null)
      }}>
      <View style={s.mask}>
        <View style={s.box}>
          <Txt v="h2">{force ? '需要更新才能继续使用' : `新版本 ${update.latest ?? ''}`}</Txt>
          {update.notes ? (
            <ScrollView style={{ maxHeight: 240 }}>
              <Txt>{update.notes}</Txt>
            </ScrollView>
          ) : null}
          {update.downloadUrl ? (
            <Button title="去更新" variant="primary" onPress={() => Linking.openURL(update.downloadUrl!)} />
          ) : (
            <Txt muted v="small">
              请到应用商店更新
            </Txt>
          )}
          {force ? null : (
            <Button
              title="以后再说"
              onPress={() => {
                if (update.latest) useSettings.getState().dismissVersion(update.latest)
                setUpdate(null)
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

/** 记完一笔：屏幕中间盖一枚“入账”白文印，从天而降、落地就停，停一会儿再慢慢淡掉（减弱动态效果时直接不显示） */
// 印泥星子：落地那一下从章边溅出去（方向、远近、大小各不一样，看着不整齐）
const SPECKS = [
  { a: -150, d: 1, r: 1 },
  { a: -105, d: 1.35, r: 0.7 },
  { a: -60, d: 1.1, r: 1.2 },
  { a: 25, d: 1.25, r: 0.8 },
  { a: 160, d: 0.95, r: 0.9 },
] as const

function Speck({ burst, a, d, r }: { burst: SharedValue<number>; a: number; d: number; r: number }) {
  const rad = (a * Math.PI) / 180
  // 从章边下面溅出去，飞出章外一大截（真机上原来飞得太近，大半被章挡住）
  const from = size.sealLg * 0.5
  const to = from + space.xl * 1.6 * d
  const dot = Math.round(space.xxs * r + 2)
  const style = useAnimatedStyle(() => {
    const k = burst.value
    const dist = from + (to - from) * k
    return {
      opacity: k <= 0 || k >= 1 ? 0 : 0.9 * (1 - k * k),
      transform: [{ translateX: Math.cos(rad) * dist }, { translateY: Math.sin(rad) * dist }, { scale: 1 - 0.5 * k }],
    }
  })
  return <Animated.View style={[{ position: 'absolute', width: dot, height: dot, borderRadius: dot / 2, backgroundColor: colors.seal }, style]} />
}

export function StampOverlay() {
  const n = useUi((st) => st.stamp)
  const reduce = useReducedMotion()
  const scale = useSharedValue(0)
  const opacity = useSharedValue(0)
  const burst = useSharedValue(0)
  useEffect(() => {
    if (!n || reduce) return
    scale.value = STAMP_FROM
    opacity.value = 0
    burst.value = 0
    scale.value = withTiming(1, STAMP_PRESS)
    opacity.value = withSequence(withTiming(1, { duration: 140 }), withDelay(STAMP_PRESS.duration + STAMP_HOLD_MS, withTiming(0, STAMP_FADE)))
    // 落地那一刻溅出印泥，0.4 秒散完
    burst.value = withDelay(STAMP_PRESS.duration, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }))
    const t = stampThud()
    return () => clearTimeout(t)
  }, [n, reduce, scale, opacity, burst])
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }, { rotate: '-8deg' }] }))
  if (!n || reduce) return null
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {SPECKS.map((p, i) => (
        <Speck key={i} burst={burst} {...p} />
      ))}
      <Animated.View style={anim}>
        <Seal char={ENTRY_STAMP} px={size.sealLg} filled />
      </Animated.View>
    </View>
  )
}

/**
 * 轻提示的外壳：从底下弹上来（弹簧，冲过头一点再落稳）；左右一划跟着手走，划够了甩出去，没划够松手弹回。
 * 系统开了“减少动态效果”时直接出现，划走也不甩
 */
function SwipeAway({ id, onDismiss, children }: { id: string; onDismiss: () => void; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  const x = useSharedValue(0)
  const y = useSharedValue(reduce ? 0 : space.xxl * 2) // 一出来就在下面，免得第一帧在终点闪一下
  useEffect(() => {
    x.value = 0
    if (reduce) return
    y.value = space.xxl * 2
    y.value = withSpring(0, SPRING)
  }, [id, reduce, x, y])
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      x.value = e.translationX
    })
    .onEnd((e) => {
      if (Math.abs(x.value) > space.xxl * 2 || Math.abs(e.velocityX) > 800) {
        const dir = Math.sign(x.value || e.velocityX)
        x.value = withTiming(dir * 420, { duration: 220 }, (done) => done && runOnJS(onDismiss)())
      } else x.value = withSpring(0, SPRING)
    })
  const style = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(x.value) / 260, 0.8),
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${x.value / 18}deg` }],
  }))
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style} exiting={reduce ? undefined : FadeOut.duration(160)}>
        {children}
      </Animated.View>
    </GestureDetector>
  )
}

/** 轻提示：底部弹出，约 3 秒后消失（用于预算提醒、“已记 · 撤销”等），可以左右划走 */
export function Toast() {
  const toast = useUi((s) => s.toast)
  const verse = useUi((s) => s.verse)
  const action = useUi((s) => s.toastAction)
  const hide = useUi((s) => s.hideToast)
  useEffect(() => {
    if (!toast && !verse) return
    const t = setTimeout(hide, verse ? 4500 : action ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [toast, verse, action, hide])
  if (verse) {
    return (
      <View pointerEvents="box-none" style={s.toastWrap} accessibilityLiveRegion="polite">
        <SwipeAway id={verse.verse} onDismiss={hide}>
          <Pressable onPress={hide} style={[s.toast, { paddingVertical: space.md }]}>
            <VerseBlock v={verse} light />
          </Pressable>
        </SwipeAway>
      </View>
    )
  }
  if (!toast) return null
  return (
    <View pointerEvents="box-none" style={s.toastWrap} accessibilityLiveRegion="polite">
      <SwipeAway id={toast} onDismiss={hide}>
      <View style={[s.toast, action && { flexDirection: 'row', alignItems: 'center', gap: space.md }]}>
        <Txt v="small" color={colors.white} center>
          {toast}
        </Txt>
        {action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={space.sm}
            onPress={() => {
              action.onPress()
              hide()
            }}
          >
            <Txt v="small" medium color={colors.gold}>
              {action.label}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      </SwipeAway>
    </View>
  )
}

// 执行意图：先说好“几点记”，比笼统地想着“每天记账”更容易坚持
const TIMES: [time: string, label: string][] = [
  ['12:30', '午饭后'],
  ['18:00', '下班路上'],
  ['20:30', '晚饭后'],
  ['22:00', '睡前'],
]

/** 首次打开时问一次“你一般几点有空记账？”，按回答设每天的提醒 */
export function ReminderAsk() {
  const asked = useSettings((s) => s.reminderAsked)
  const locked = useUi((s) => s.locked)
  const [custom, setCustom] = useState<string | null>(null)
  if (asked || locked) return null

  const pick = async (time: string) => {
    const st = useSettings.getState()
    if (!(await st.setReminder(true, time))) {
      st.markReminderAsked()
      showAlert('没有通知权限', '以后可以在「掌柜 → 记账提醒」里开启')
    }
  }

  return (
    <Sheet visible onClose={() => useSettings.getState().markReminderAsked()} title="你一般几点有空记账？" scroll={false}>
      <Txt v="small" muted center style={{ paddingHorizontal: GUTTER, paddingBottom: space.sm }}>
        每天到点提醒一次；当天已经记过账就不打扰。
      </Txt>
      {TIMES.map(([time, label]) => (
        <ListRow key={time} title={label} value={time} onPress={() => void pick(time)} />
      ))}
      {custom === null ? (
        <ListRow title="自己选时间" onPress={() => setCustom('21:00')} />
      ) : (
        <>
          <DateField label="提醒时间" mode="time" value={custom} onChange={setCustom} />
          <View style={{ paddingHorizontal: GUTTER }}>
            <Button title={`就定 ${custom}`} variant="primary" onPress={() => void pick(custom)} />
          </View>
        </>
      )}
      <Button title="先不用" variant="ghost" onPress={() => useSettings.getState().markReminderAsked()} />
    </Sheet>
  )
}

const s = StyleSheet.create({
  toastWrap: { position: 'absolute', left: space.xl, right: space.xl, bottom: size.tabBar * 2, alignItems: 'center', zIndex: 200 },
  toast: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs + 2, opacity: 0.92 },
  lock: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: space.xl, zIndex: 100, padding: space.xxl },
  mask: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: space.xxl },
  box: { backgroundColor: colors.surface, borderRadius: radius.sheet, padding: space.lg, gap: space.sm, ...shadowRaised },
})

/** 底部操作菜单：useUi().showActions({ title, items }) 打开；点一项先关菜单再执行 */
export function ActionSheet() {
  const menu = useUi((u) => u.actions)
  const hide = useUi((u) => u.hideActions)
  return (
    <Sheet visible={!!menu} onClose={hide} title={menu?.title}>
      {menu?.items.map((a) => (
        <ListRow
          key={a.label}
          title={a.label}
          danger={a.danger}
          chevron={false}
          onPress={() => {
            hide()
            a.onPress()
          }}
        />
      ))}
    </Sheet>
  )
}

/**
 * 弹窗（确认、提示）：和页面一样的卡片、文楷标题、页面上同款按钮，不用系统弹窗。
 * 按钮少于三个横排，取消在左；危险操作和确定用朱红主按钮。点遮罩、按返回 = 取消（没有取消按钮就不关）
 */
const HOLD_MS = 1500

export function DialogHost() {
  const d = useUi((u) => u.dialog)
  const hide = useUi((u) => u.hideDialog)
  const press = (b: DialogButton | undefined) => {
    hide()
    b?.onPress?.()
  }
  const cancel = d?.buttons.find((b) => b.style === 'cancel')
  const dismiss = () => cancel && press(cancel)
  const last = d ? d.buttons.length - 1 : 0
  return (
    <Modal visible={!!d} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}>
      <Pressable
        accessibilityLabel="关闭"
        onPress={dismiss}
        style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl }}
      >
        {d ? (
          <Pressable
            accessibilityRole="alert"
            onPress={() => {}}
            style={[{ width: '100%', maxWidth: size.dialog, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.md }, shadowRaised]}
          >
            <Txt v="h2" serif center>
              {d.title}
            </Txt>
            {d.message ? (
              // 一句话的居中；长的、分段的左对齐（居中时末尾常常一个字挂一行）
              <Txt muted center={d.message.length <= 20 && !d.message.includes('\n')}>
                {d.message}
              </Txt>
            ) : null}
            <View style={{ flexDirection: d.buttons.length > 2 ? 'column' : 'row', gap: space.sm, marginTop: space.xs }}>
              {d.buttons.map((b, i) => (
                <Button
                  key={b.text}
                  title={b.text}
                  size="md"
                  // 普通确认墨色；危险的红字（朱红是“记”和每页主按钮的颜色，不再代表危险）；回不去的要按住
                  variant={b.style === 'destructive' ? 'danger' : b.style !== 'cancel' && i === last ? 'ink' : 'secondary'}
                  holdMs={b.hold ? HOLD_MS : undefined}
                  onPress={() => press(b)}
                  style={d.buttons.length > 2 ? undefined : { flex: 1 }}
                />
              ))}
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  )
}

/** 连续记账到关口：屏幕中间一张小卡片，大火苗 + 四个字 + 一句白话 + 一句古话；3.5 秒后自己收起，点一下也收起 */
export function StreakMomentOverlay() {
  const m = useUi((st) => st.streakMoment)
  const hide = useUi((st) => st.hideStreakMoment)
  useEffect(() => {
    if (!m) return
    const t = setTimeout(hide, 3500)
    return () => clearTimeout(t)
  }, [m, hide])
  if (!m) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${m.title}。${m.line}点按关闭`}
      onPress={hide}
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: GUTTER }]}
    >
      <Animated.View
        entering={itemIn}
        exiting={itemOut}
        style={[{ width: '100%', maxWidth: size.sheetMax * 0.7, backgroundColor: colors.surface, borderRadius: radius.sheet, paddingVertical: space.xl, paddingHorizontal: space.lg, alignItems: 'center', gap: space.xs }, shadowRaised]}
      >
        <Flame level={flameLevel({ streak: m.days, todayCounted: true })} px={size.flameMoment} />
        <Txt v="title" serif center style={{ letterSpacing: space.xxs }}>
          {m.title}
        </Txt>
        <Txt v="small" muted center>
          {m.line}
        </Txt>
        <Txt v="small" serif center>
          {m.verse}
        </Txt>
      </Animated.View>
    </Pressable>
  )
}
