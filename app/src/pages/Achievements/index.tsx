import { useEffect, useState } from 'react'
import { Image, Modal, Pressable, useWindowDimensions, View } from 'react-native'
import { ProgressBar } from '../../components/Bars'
import { Button } from '../../components/Button'
import { ListRow } from '../../components/ListRow'
import { EmptyState, Stat } from '../../components/Misc'
import { Plaque, plaqueOf } from '../../components/Plaque'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { goalActions } from '../../hooks/actions'
import { useGoals, useLedgers } from '../../hooks/data'
import { usePhoto } from '../../hooks/photo'
import { useAuth } from '../../store/authStore'
import { useSettings } from '../../store/settingsStore'
import { colors, GUTTER, radius, space } from '../../theme'
import type { GoalView } from '../../types/domain'
import { useUi } from '../../store/uiStore'
import type { StackProps } from '../../types/navigation'
import { today } from '../../utils/dates'
import { goalCopy, paceOf, POSTPONE_MONTHS, tierOf, tierRank } from '../../utils/goals'
import { VerseBlock } from '../../components/Verse'
import { attempt } from '../../components/dialogs'
import { formatPlain, formatYuan } from '../../utils/money'

/** 进度提示：还差多少；有期限时每月还要存多少 */
function paceText(g: GoalView) {
  const p = paceOf(g.targetCents, g.balanceCents, g.deadline, today())
  if (p.overdue) return `过了期限，还差 ${formatYuan(p.remainingCents)}`
  if (p.monthsLeft !== null && p.perMonthCents !== null) return `离期限还有 ${p.monthsLeft} 个月，每月存 ${formatYuan(p.perMonthCents)} 就够`
  return `还差 ${formatYuan(p.remainingCents)}`
}

/** 心愿：上面“在攒”的目标，下面“如愿”（攒够后挂上的牌匾） */
export default function AchievementsPage({ navigation }: StackProps<'Achievements'>) {
  const goals = useGoals()
  const main = useLedgers().find((l) => l.type === 'personal')
  const setLedger = useSettings((s) => s.setLedger)
  const isVip = useAuth((s) => !!s.user?.isVip)
  const { width } = useWindowDimensions()
  const [big, setBig] = useState<GoalView | null>(null)
  // 进页面时各取一句，重绘时不变
  const [verses] = useState(() => ({ reached: goalCopy('reached'), overdue: goalCopy('overdue') }))

  // 别的手机存的钱同步过来后，也要检查有没有存满
  useEffect(() => navigation.addListener('focus', () => goalActions.check()), [navigation])

  const active = goals.filter((g) => g.status === 'active')
  const achieved = goals
    .filter((g) => g.status === 'achieved')
    .sort((a, b) => tierRank(tierOf(b.targetCents)) - tierRank(tierOf(a.targetCents)) || (b.achievedOn ?? '').localeCompare(a.achievedOn ?? ''))
  const archived = goals.filter((g) => g.status === 'archived' && g.balanceCents > 0)
  const pending = achieved.filter((g) => !g.fulfilledOn)
  const totalSaved = achieved.reduce((s, g) => s + g.targetCents, 0)

  // 储钱罐在主账本里：存取前先切到主账本
  const move = (params: { transferTo?: string; transferFrom?: string }) => {
    if (main) setLedger(main.id)
    navigation.navigate('EntryEdit', params)
  }
  const newGoal = () => {
    if (!isVip && active.length >= 1) {
      return useUi.getState().showVipSheet('wishes') // 免费可以同时攒 1 个
    }
    navigation.navigate('GoalForm', {})
  }
  const plaqueW = (width - GUTTER * 2 - space.sm) / 2

  return (
    <Screen>
      <Section>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="如愿" value={`${achieved.length} 块`} v="title" />
          <Stat label="在攒" value={`${active.length}`} v="title" />
          <Stat label="累计攒下" value={formatPlain(totalSaved)} v="title" />
        </View>
      </Section>

      {pending.length > 0 ? (
        <Section style={{ gap: space.sm }}>
          <VerseBlock v={verses.reached} align="left" />
          <Txt v="small" muted>
            「{pending[0]!.name}」攒够了。钱用在了它上面，就来盖一枚“圆梦”印。
          </Txt>
          <Button title="去圆梦" variant="primary" size="md" onPress={() => navigation.navigate('GoalFulfill', { id: pending[0]!.id })} />
        </Section>
      ) : null}

      <Section title="在攒" action={{ label: '＋ 立个心愿', onPress: newGoal }} plain>
        {active.length === 0 ? (
          <Txt v="small" muted>
            想要的，值得慢慢攒。给想做的事立个目标，比如“年底看海 ¥5,000”；攒够了，它会变成一块牌匾，去实现它，再盖上“圆梦”印。
          </Txt>
        ) : (
          active.map((g) => (
            <Section key={g.id} style={{ gap: space.sm }}>
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('GoalForm', { id: g.id })} style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
                  <Txt v="h2" style={{ flex: 1 }} numberOfLines={1}>
                    {g.name}
                  </Txt>
                  <Txt serif>
                    {formatPlain(g.balanceCents)}
                    <Txt v="small" muted>
                      {' '}
                      / {formatPlain(g.targetCents)}
                    </Txt>
                  </Txt>
                </View>
                <ProgressBar ratio={Math.min(1, g.balanceCents / g.targetCents)} />
                <Txt v="small" muted>
                  {paceText(g)}
                </Txt>
              </Pressable>
              {paceOf(g.targetCents, g.balanceCents, g.deadline, today()).overdue ? (
                <View style={{ gap: space.sm }}>
                  <VerseBlock v={verses.overdue} align="left" />
                  <View style={{ flexDirection: 'row', gap: space.xs }}>
                    {POSTPONE_MONTHS.map((n) => (
                      <View key={n} style={{ flex: 1 }}>
                        <Button title={`延 ${n} 个月`} size="sm" onPress={() => attempt(() => goalActions.postpone(g.id, n))} />
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Button title="存一笔" variant="primary" size="md" onPress={() => move({ transferTo: g.walletId })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="取出" size="md" disabled={g.balanceCents <= 0} onPress={() => move({ transferFrom: g.walletId })} />
                </View>
              </View>
            </Section>
          ))
        )}
      </Section>

      <Section title="如愿" plain>
        {achieved.length === 0 ? (
          <EmptyState glyph="treasure-bowl" text="存满第一个目标，这里就会挂上第一块牌匾" />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {achieved.map((g) => (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                accessibilityHint={g.fulfilledOn ? '放大看' : '去圆梦'}
                onPress={() => (g.fulfilledOn ? setBig(g) : navigation.navigate('GoalFulfill', { id: g.id }))}
              >
                <Plaque {...plaqueOf(g)} width={plaqueW} />
              </Pressable>
            ))}
          </View>
        )}
        <Txt v="caption" faint>
          牌匾按目标金额分五档：铜、银、金、玉、聚宝盆。攒够了挂上牌匾，去实现它再盖“圆梦”印；钱取出来用掉，牌匾也一直留着。
        </Txt>
      </Section>

      {archived.length > 0 ? (
        <Section list title="先收起来的目标（罐里还有钱）">
          {archived.map((g) => (
            <ListRow key={g.id} glyph="treasure-bowl" title={g.name} subtitle={`储钱罐里还有 ${formatYuan(g.balanceCents)}`} value="取出" onPress={() => move({ transferFrom: g.walletId })} />
          ))}
        </Section>
      ) : null}

      <Modal transparent visible={!!big} animationType="fade" statusBarTranslucent onRequestClose={() => setBig(null)}>
        <Pressable
          accessibilityLabel="关闭"
          onPress={() => setBig(null)}
          style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: GUTTER }}
        >
          {big ? (
            <View style={{ gap: space.md, alignItems: 'center' }}>
              <Plaque {...plaqueOf(big)} width={width - GUTTER * 2} />
              <GoalPhoto g={big} width={width - GUTTER * 2} />
              {big.wish ? (
                <Txt color={colors.white} center>
                  「{big.wish}」
                </Txt>
              ) : null}
              <Txt v="small" color={colors.white} center>
                {big.fulfilledOn?.replace(/-/g, '.')} 圆梦
              </Txt>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </Screen>
  )
}

/** 圆梦照片：本机有就直接显示，没有就从云端下载（同一账号的其他手机） */
function GoalPhoto({ g, width }: { g: GoalView; width: number }) {
  const { uri } = usePhoto('goals', g.id, g)
  return uri ? (
    <Image source={{ uri }} resizeMode="cover" style={{ width, aspectRatio: 4 / 3, borderRadius: radius.md }} accessibilityIgnoresInvertColors />
  ) : null
}
