import { useState } from 'react'
import { View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Button } from '../../components/Button'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Segmented } from '../../components/Chip'
import { attempt } from '../../components/dialogs'
import { EmptyState, Stat } from '../../components/Misc'
import { itemIn, itemLayout } from '../../components/motion'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { txnActions } from '../../hooks/actions'
import { useReviewed } from '../../hooks/data'
import { colors, necessityColors, space } from '../../theme'
import type { Review, TxnView } from '../../types/domain'
import type { StackProps } from '../../types/navigation'
import { dayLabel, monthLabel } from '../../utils/dates'
import { formatYuan } from '../../utils/money'

const VERDICTS: { value: Review; label: string }[] = [
  { value: 'necessary', label: '必要' },
  { value: 'unnecessary', label: '非必要' },
]

const INTRO = '回头看看这个月花得值不值：每笔标记必要或非必要'

/** 结束页的话：不评判，只陈述 */
function closing(need: number, noNeed: number) {
  if (noNeed === 0) return '这个月的花销，你心里都有数。'
  if (need >= noNeed) return '大部分钱都花在了该花的地方。'
  return '看清楚哪些可以不花，下个月就更有数了。'
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
  if (done.length === 0) return null
  return (
    <Section title={`已复盘 ${done.length} 笔 · 点选可以改`}>
      {done.map((t) => (
        <ReviewedRow key={t.id} t={t} />
      ))}
    </Section>
  )
}

export default function ReviewPage({ navigation, route }: StackProps<'Review'>) {
  const { month } = route.params
  // 开始时定下这一轮要看的几笔，标记过程中列表不变
  const [list] = useState(() => txnActions.reviewList(month))
  const [i, setI] = useState(0)
  const done = useReviewed(month)

  const mark = (r: Review) => {
    if (attempt(() => txnActions.review(list[i]!.id, r))) setI(i + 1)
  }

  if (list.length === 0)
    return (
      <Screen>
        <Txt v="small" muted center>
          {INTRO}
        </Txt>
        <EmptyState glyph="seal" text="这个月没有需要复盘的花销了" />
        <ReviewedSection done={done} />
      </Screen>
    )

  if (i >= list.length) {
    const need = done.filter((t) => t.review === 'necessary').length
    const noNeed = done.length - need
    const pct = (n: number) => (done.length ? Math.round((n / done.length) * 100) : 0)
    return (
      <Screen footer={<Button title="好的" variant="primary" onPress={() => navigation.goBack()} />}>
        <Section title={`${monthLabel(month)}复盘`}>
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
  return (
    <Screen>
      <Txt v="small" muted center>
        {INTRO}
      </Txt>
      <Txt v="caption" faint center>
        第 {i + 1} / {list.length} 笔
      </Txt>
      <Animated.View key={t.id} entering={itemIn}>
        <Section>
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
        </Section>
      </Animated.View>
      {/* 下次再说：直接离开，已标记的保留，没标记的下次还会出现 */}
      <Button title="下次再说" variant="ghost" onPress={() => navigation.goBack()} />
      <ReviewedSection done={done} />
    </Screen>
  )
}
