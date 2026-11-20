import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import { Button } from '../../components/Button'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Segmented } from '../../components/Chip'
import { attempt } from '../../components/dialogs'
import { EmptyState, Stat } from '../../components/Misc'
import { itemIn, itemLayout, SPRING } from '../../components/motion'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { txnActions } from '../../hooks/actions'
import { useReviewed } from '../../hooks/data'
import { colors, necessityColors, radius, shadow, shadowRaised, space } from '../../theme'
import type { Review, TxnView } from '../../types/domain'
import type { StackProps } from '../../types/navigation'
import { dayLabel, monthLabel } from '../../utils/dates'
import { formatYuan } from '../../utils/money'

const VERDICTS: { value: Review; label: string }[] = [
  { value: 'necessary', label: '必要' },
  { value: 'unnecessary', label: '非必要' },
]

// 暖心、往前看的话，不说教（用户：要用励志暖心的话，把钱花在刀刃上）
const INTRO = '把钱花在刀刃上。这个月弹性、享受的花销，一笔笔标一标必不必要。'
// 已经标过的先列最近这几笔，多了点“全部”展开（每笔弹性、享受都要看，一个月可能上百笔）
const DONE_SHOWN = 5

/** 结束页的话：只鼓励，不评判 */
function closing(need: number, noNeed: number) {
  if (noNeed === 0) return '这个月的钱，都花在了刀刃上。'
  if (need >= noNeed) return '大部分钱都花在了刀刃上。'
  return '看清了哪些可以省，下个月的钱会更听你的话。'
}

// 一叠卡片：后面最多露两张，每张往下露一道边、略小、略歪，像一叠账条
const PEEK = space.sm
const BEHIND = 2
const TILT = 1.4

/** 叠里的一张：p 是第几层（0 最上面）。换层时弹簧挪过去；后面的只是空白的纸，最上面那张才写内容 */
function DeckCard({ p, tilt, children }: { p: number; tilt: number; children: ReactNode }) {
  const reduce = useReducedMotion()
  const pos = useSharedValue(p)
  useEffect(() => {
    pos.value = reduce ? p : withSpring(p, SPRING)
  }, [p, reduce, pos])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: pos.value * PEEK }, { scale: 1 - pos.value * 0.05 }, { rotate: `${pos.value * tilt}deg` }],
  }))
  return (
    <Animated.View
      style={[
        { flex: p > 0 ? 1 : undefined, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: space.sm, transformOrigin: 'bottom' },
        p > 0 ? shadow : shadowRaised,
        style,
      ]}
    >
      {p === 0 ? <Animated.View entering={itemIn} style={{ gap: space.sm }}>{children}</Animated.View> : null}
    </Animated.View>
  )
}

/** 最上面那张标完飞走：必要往右、非必要往左，边飞边转、变淡 */
function flyOut(dir: SharedValue<number>) {
  return (values: { windowWidth: number }) => {
    'worklet'
    const d = dir.value
    const t = { duration: 260, easing: Easing.in(Easing.quad) }
    return {
      initialValues: { transform: [{ translateX: 0 }, { rotate: '0deg' }], opacity: 1 },
      animations: { transform: [{ translateX: withTiming(d * values.windowWidth, t) }, { rotate: withTiming(`${d * 12}deg`, t) }], opacity: withTiming(0, t) },
    }
  }
}

/** 已复盘的一笔：可以直接改标记 */
function ReviewedRow({ t }: { t: TxnView }) {
  return (
    <Animated.View entering={itemIn} layout={itemLayout} style={{ gap: space.xs, paddingVertical: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {t.categoryIcon ? <CategoryIcon icon={t.categoryIcon} color={t.categoryColor} /> : null}
        <View style={{ flex: 1 }}>
          <Txt numberOfLines={1}>{t.note || t.categoryName}</Txt>
          <Txt v="caption" muted>
            {dayLabel(t.date)}
          </Txt>
        </View>
        <Txt serif>{formatYuan(t.amountCents)}</Txt>
      </View>
      <Segmented options={VERDICTS} value={t.review as Review} onChange={(v) => attempt(() => txnActions.review(t.id, v))} />
    </Animated.View>
  )
}

function ReviewedSection({ done }: { done: TxnView[] }) {
  const [all, setAll] = useState(false)
  if (done.length === 0) return null
  const shown = all ? done : done.slice(0, DONE_SHOWN)
  return (
    <Section title={`已细算 ${done.length} 笔 · 点选可以改`}>
      {shown.map((t) => (
        <ReviewedRow key={t.id} t={t} />
      ))}
      {done.length > shown.length ? <Button title={`全部 ${done.length} 笔`} variant="ghost" onPress={() => setAll(true)} /> : null}
    </Section>
  )
}

export default function ReviewPage({ navigation, route }: StackProps<'Review'>) {
  const { month } = route.params
  // 开始时定下这一轮要看的几笔，标记过程中列表不变
  const [list] = useState(() => txnActions.reviewList(month))
  const [i, setI] = useState(0)
  const done = useReviewed(month)
  const reduce = useReducedMotion()
  const dir = useSharedValue(1) // 最上面那张往哪边飞

  const mark = (r: Review) => {
    if (!attempt(() => txnActions.review(list[i]!.id, r))) return
    dir.value = r === 'necessary' ? 1 : -1
    setI(i + 1)
  }

  if (list.length === 0)
    return (
      <Screen>
        <Txt v="small" muted center>
          {INTRO}
        </Txt>
        <EmptyState glyph="seal" text="这个月的花销都细算过了" />
        <ReviewedSection done={done} />
      </Screen>
    )

  if (i >= list.length) {
    const need = done.filter((t) => t.review === 'necessary').length
    const noNeed = done.length - need
    const pct = (n: number) => (done.length ? Math.round((n / done.length) * 100) : 0)
    return (
      <Screen footer={<Button title="好的" variant="primary" onPress={() => navigation.goBack()} />}>
        <Section title={`${monthLabel(month)}细算`}>
          <View style={{ flexDirection: 'row' }}>
            <Stat value={`${pct(need)}%`} label="必要" v="display" color={necessityColors.necessary} />
            <Stat value={`${pct(noNeed)}%`} label="非必要" v="display" color={necessityColors.unnecessary} />
          </View>
          <Txt center>{closing(need, noNeed)}</Txt>
        </Section>
        <ReviewedSection done={done} />
      </Screen>
    )
  }

  const t = list[i]!
  // 这一张和后面露边的两张；先画最下面的，最上面那张最后画（盖在上面）。原来的“第 1 / 2 笔”改成这叠卡片（用户要的）
  const deck = list.slice(i, i + 1 + BEHIND).map((x, k) => ({ x, p: k, tilt: ((i + k) % 2 ? 1 : -1) * TILT })).reverse()
  const card = (
    <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {t.categoryIcon ? <CategoryIcon icon={t.categoryIcon} color={t.categoryColor} variant="lg" /> : null}
            <View style={{ flex: 1, gap: space.xxs }}>
              <Txt v="h2">{t.categoryName}</Txt>
              <Txt v="small" muted>
                {dayLabel(t.date)}
                {t.note ? ` · ${t.note}` : ''}
              </Txt>
            </View>
          </View>
          <Txt v="display" center style={{ paddingVertical: space.md }}>
            {formatYuan(t.amountCents)}
          </Txt>
          <Txt muted center>
            回头看，这笔：
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="必要" variant="primary" onPress={() => mark('necessary')} style={{ flex: 1 }} />
            <Button title="非必要" onPress={() => mark('unnecessary')} style={{ flex: 1 }} />
          </View>
    </>
  )
  return (
    <Screen>
      <Txt v="small" muted center>
        {INTRO}
      </Txt>
      {/* 叠里最多露三张，剩得多时说一声还有几笔 */}
      {list.length - i > 1 + BEHIND ? (
        <Txt v="caption" muted center>
          还有 {list.length - i} 笔
        </Txt>
      ) : null}
      {/* 外层留出后面几张露边的地方；里层的大小就是最上面那张，后面几张铺满它再往下挪 */}
      <View style={{ paddingBottom: PEEK * Math.min(BEHIND, list.length - i - 1) }}>
        <View>
          {deck.map(({ x, p, tilt }) => (
            <Animated.View key={x.id} exiting={reduce ? undefined : flyOut(dir)} style={p > 0 ? StyleSheet.absoluteFill : null}>
              <DeckCard p={p} tilt={tilt}>
                {p === 0 ? card : null}
              </DeckCard>
            </Animated.View>
          ))}
        </View>
      </View>
      {/* 下次再说：直接离开，已标记的保留，没标记的下次还会出现 */}
      <Button title="下次再说" variant="ghost" onPress={() => navigation.goBack()} />
      <ReviewedSection done={done} />
    </Screen>
  )
}
