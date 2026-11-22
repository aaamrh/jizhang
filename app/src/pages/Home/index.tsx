import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { itemIn, itemLayout, itemOut, useCountUp } from '../../components/motion'
import { ProgressBar } from '../../components/Bars'
import { Button } from '../../components/Button'
import { attempt } from '../../components/dialogs'
import { FeatureIcon, Icon } from '../../components/Icon'
import { Calendar, Search, X } from '../../components/icons/ui'
import { RetroGlyph } from '../../components/RetroGlyph'
import { ListRow } from '../../components/ListRow'
import { Ornament } from '../../components/Ornament'
import { EmptyState, MoneyStat, moneyScale, YearMonthBlock } from '../../components/Misc'
import { LedgerSwitch } from '../../components/LedgerSwitch'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { TxnItem, TxnRow } from '../../components/TxnItem'
import { Flame } from '../../components/Flame'
import { InvitePick, MemberPick } from '../../components/MemberAvatar'
import { dayActions } from '../../hooks/actions'
import { accountActions } from '../../hooks/account'
import {
  useBudgetStatus,
  useSyncNudge,
  useGoals,
  useLastYearReportHint,
  useFamilies,
  useRecurrings,
  useMembers,
  useMonthView,
  useStreak,
} from '../../hooks/data'
import { useStreakMoment } from '../../hooks/streak'
import { useFamilyMonth } from '../../hooks/familyFeed'
import { syncNow, usePullRefresh } from '../../hooks/sync'
import { useAuth } from '../../store/authStore'
import { useSettings } from '../../store/settingsStore'
import { useUi } from '../../store/uiStore'
import { amountColor, colors, expenseColor, GUTTER, iconSize, incomeColor, radius, size, space, tint } from '../../theme'
import type { TabProps } from '../../types/navigation'
import { recordedBy, recordedSpend, whoLabel } from '../../utils/members'
import { flameLevel } from '../../utils/streak'
import { VIP_NAME } from '../../utils/copy'
import { formatPlain, formatSigned, formatYuan } from '../../utils/money'
import { addDays, dayLabel, daysInclusive, today } from '../../utils/dates'

/** 周期账下次的日子：明天、后天、大后天 */
function soonLabel(d: string) {
  const n = daysInclusive(today(), d) - 1
  return n === 1 ? '明天' : n === 2 ? '后天' : n === 3 ? '大后天' : dayLabel(d)
}

/** 快捷入口：圆底图标 + 小字 */
function Quick({ glyph, label, badge, onPress }: { glyph: string; label: string; badge?: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: space.xs }, pressed && { opacity: 0.6 }]}>
      <View>
        <FeatureIcon name={glyph} />
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: -space.xxs,
              right: -space.xxs,
              minWidth: space.md,
              height: space.md,
              paddingHorizontal: space.xxs,
              borderRadius: radius.pill,
              backgroundColor: colors.seal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt v="caption" color={colors.white} style={{ lineHeight: space.md }}>
              {badge}
            </Txt>
          </View>
        ) : null}
      </View>
      <Txt v="caption" muted>
        {label}
      </Txt>
    </Pressable>
  )
}

export default function HomePage({ navigation }: TabProps<'Home'>) {
  const { month, setMonth, excludeAssets, setFamilyView } = useSettings()
  // 家庭账本是一家人各自账的汇总，从服务器取；可以在好几个家庭里，首页切到哪个看哪个（记账照样记在我的账本）
  const { viewed: family } = useFamilies()
  const familyView = !!family
  const mine = useMonthView(month, excludeAssets)
  const fam = useFamilyMonth(familyView ? family!.id : null, month)
  const { summary, groups } = familyView ? fam : mine
  const { reviewCount } = mine
  const myUserId = useAuth((a) => a.user?.id ?? null)
  const isVip = useAuth((a) => !!a.user?.isVip)
  const nudge = useSyncNudge()
  const snoozeNudge = useSettings((st) => st.snoozeSyncNudge)
  const openSync = async () => {
    if (nudge === 'login') return navigation.navigate('Login')
    await accountActions.turnOnSync() // 点了“暂不开启”会顺手让首页这句 30 天内不再提
  }
  const streak = useStreak()
  // 家庭账本：只看某个家人记的账（null = 全部）
  const [pickedWho, setWho] = useState<string | null>(null)
  const budget = useBudgetStatus(month)
  // 三天内要自动记的周期账（最近的一条），首页提一句
  const recurrings = useRecurrings()
  const soon = useMemo(() => {
    const t = today()
    const limit = addDays(t, 3)
    return recurrings.filter((r) => r.next && r.next <= limit).sort((a, b) => (a.next! < b.next! ? -1 : 1))[0]
  }, [recurrings])
  const lastYear = useLastYearReportHint()
  const goals = useGoals()
  const members = useMembers(family?.id)
  const canSync = useAuth((a) => !!a.token && !!a.syncConsent)
  const pull = usePullRefresh(familyView ? () => syncNow().then(fam.reload) : syncNow)

  const noSpend = (on: boolean) => {
    if (attempt(() => dayActions.setNoSpend(on)) && on) useUi.getState().showToast('零花费日，又省下一天')
  }
  // 今天还没记：火苗灰着，不说“要断了”；断了也不提断了几天
  const streakText = streak.todayCounted ? `连续记账 ${streak.streak} 天` : streak.streak > 0 ? `已连续 ${streak.streak} 天 · 今天还没记` : '今天记一笔，点起火苗'
  useStreakMoment(streak)

  // 在攒的心愿：进度最高的那个；没有就邀请立一个
  const active = goals.filter((g) => g.status === 'active').sort((a, b) => b.balanceCents / b.targetCents - a.balanceCents / a.targetCents)[0]
  const goalText = active
    ? `${Array.from(active.name).slice(0, 6).join('')} ${Math.min(99, Math.floor((active.balanceCents / active.targetCents) * 100))}%`
    : '立个心愿'

  // 家庭账本：家人头像下面是这个月他记了多少，点头像只看他记的账。只认“谁记的”，不分“谁花的”（见 docs/决策.md）
  // 只算有账号、还在家里的人（旧数据里没账号的“家人档案”不显示）
  const recorders = familyView ? members.filter((m) => !m.removed && m.role !== 'profile') : []
  // 切换账本后之前选的人不在这个账本里：当作没选
  const who = pickedWho && recorders.some((m) => m.id === pickedWho) ? pickedWho : null
  const spend = useMemo(() => recordedSpend(groups.flatMap((g) => g.items), members), [groups, members])
  const shown = useMemo(() => {
    if (!familyView || !who) return groups
    return groups
      .map((g) => {
        const items = g.items.filter((t) => recordedBy(t, who, members))
        const sum = (type: string) => items.filter((t) => t.type === type).reduce((a, t) => a + t.amountCents, 0)
        return { ...g, items, expenseCents: sum('expense'), incomeCents: sum('income') }
      })
      .filter((g) => g.items.length > 0)
  }, [familyView, who, groups, members])

  const exp = useCountUp(summary.expenseCents)
  const inc = useCountUp(summary.incomeCents)
  const bal = useCountUp(summary.balanceCents)
  // 用最终值算缩放，计数动画过程中字号不跳
  const scale = moneyScale(formatPlain(summary.expenseCents), formatPlain(summary.incomeCents), formatSigned(summary.balanceCents))

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 固定在顶部、不随列表滚动，尽量紧凑（360×640 的小屏也能露出 4 行以上账目）：
          年份·账本 / 月份 + 本月收支 / 预算细条 / 连续记账·在攒的心愿 / 功能入口 */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xs, paddingBottom: space.xs, gap: space.xs }}>
        {/* 顶栏：居中账本名 ▾，右侧搜索 */}
        <View style={{ height: size.navBar - space.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <LedgerSwitch onManage={() => navigation.navigate('Ledgers')} />
          {/* 右上角：搜索、记账日历（大掌柜；不是的话弹开通提醒，停在“记账日历”） */}
          <View style={{ position: 'absolute', right: 0, flexDirection: 'row', gap: space.md }}>
            <Pressable accessibilityRole="button" accessibilityLabel="搜索" hitSlop={space.xs} onPress={() => navigation.navigate('Search')} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <Icon as={Search} color={colors.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="记账日历"
              hitSlop={space.xs}
              onPress={() => (isVip ? navigation.navigate('Calendar') : useUi.getState().showVipSheet('calendar'))}
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Icon as={Calendar} color={colors.ink} />
            </Pressable>
          </View>
        </View>

        {/* 月份（左：小字年份，大字月份）+ 支出 / 收入 / 结余（右） */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
          <YearMonthBlock month={month} onChange={setMonth} />
          <View style={{ flex: 1, flexDirection: 'row', gap: space.sm, paddingBottom: space.xxs }}>
            <MoneyStat label={excludeAssets && !familyView ? '支出·不含家当' : '支出'} value={formatPlain(exp)} color={amountColor(-summary.expenseCents)} scale={scale} />
            <MoneyStat label="收入" value={formatPlain(inc)} color={amountColor(summary.incomeCents)} scale={scale} />
            <MoneyStat label="结余" value={formatSigned(bal)} color={amountColor(summary.balanceCents)} scale={scale} />
          </View>
        </View>

        {/* 细条：预算（只针对我的账本，家庭账本不设预算）。左边说用了多少，右边进预算页（原来在快捷入口里，用户要求挪到这里） */}
        {familyView ? null : budget.total ? (
          <Pressable accessibilityRole="button" accessibilityLabel="预算，点按调整" onPress={() => navigation.navigate('Budget')} style={{ gap: space.xxs }}>
            <ProgressBar ratio={budget.total.ratio} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {/* 字是正常的墨色，只有还剩 / 超出的金额带颜色（剩为绿、超为红） */}
              <Txt v="caption" numberOfLines={1} style={{ flex: 1 }}>
                预算 {formatYuan(budget.total.budgetCents)}，{budget.total.leftCents >= 0 ? '还剩 ' : '超出 '}
                <Txt v="caption" color={amountColor(budget.total.leftCents)}>
                  {formatYuan(Math.abs(budget.total.leftCents))}
                </Txt>
              </Txt>
              <Txt v="caption" muted>
                调整 ›
              </Txt>
            </View>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="设预算"
            onPress={() => navigation.navigate('Budget')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
          >
            <Txt v="caption" muted style={{ flex: 1 }}>
              还没设预算
            </Txt>
            <Txt v="caption" muted>
              去设 ›
            </Txt>
          </Pressable>
        )}

        {/* 连续记账（火苗）· 在攒的心愿（点开心愿）· 今天没花钱 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.buttonSm }}>
          <Flame level={flameLevel(streak)} px={size.flame} />
          <Txt v="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>
            {streakText}
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`心愿：${goalText}`}
            hitSlop={space.xs}
            onPress={() => navigation.navigate('Achievements')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs, paddingHorizontal: space.xs, height: size.buttonSm - space.xs, borderRadius: radius.pill, backgroundColor: tint(colors.gold, 0.12), flexShrink: 1 }}
          >
            <RetroGlyph name="treasure-bowl" color={colors.gold} px={iconSize.inline} />
            <Txt v="caption" color={colors.gold} numberOfLines={1}>
              {goalText}
            </Txt>
          </Pressable>
          <View style={{ flex: 1 }} />
          {!streak.todayCounted ? (
            <Button title="今天没花钱" variant="ghost" size="sm" onPress={() => noSpend(true)} />
          ) : streak.noSpendToday ? (
            <Button title="撤销零花费" variant="ghost" size="sm" onPress={() => noSpend(false)} />
          ) : null}
        </View>

        {/* 家庭账本：家人头像一排（这个月各记了多少），点一下只看他记的；最后是“＋邀请”（管理员） */}
        {familyView ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xxs }}>
            <MemberPick name="全部" sub={formatPlain(summary.expenseCents)} selected={who === null} onPress={() => setWho(null)} />
            {[...recorders]
              .sort((a, b) => (spend.get(b.id) ?? 0) - (spend.get(a.id) ?? 0))
              .map((m) => (
                <MemberPick
                  key={m.id}
                  name={m.isMe ? '我' : m.nickname}
                  sub={formatPlain(spend.get(m.id) ?? 0)}
                  vip={m.isVip}
                  selected={who === m.id}
                  onPress={() => setWho(who === m.id ? null : m.id)}
                />
              ))}
            {family!.myRole === 'admin' && fam.feed?.active !== false ? <InvitePick onPress={() => navigation.navigate('Invite', { ledgerId: family!.id })} /> : null}
          </ScrollView>
        ) : null}

        {/* 快捷入口（细算、心愿、定时都只针对我的账本，看家庭账本时不显示）；预算挪到了上面进度条那一行，周账并进了盘账的“周” */}
        {familyView ? null : (
        <View style={{ flexDirection: 'row' }}>
          <Quick glyph="seal" label="细算" badge={reviewCount} onPress={() => navigation.navigate('Review', { month })} />
          <Quick glyph="treasure-bowl" label="心愿" onPress={() => navigation.navigate('Achievements')} />
          <Quick glyph="cycle" label="定时" onPress={() => navigation.navigate('Recurrings')} />
          {lastYear ? <Quick glyph="thread-book" label="年账" onPress={() => navigation.navigate('YearReport', { year: lastYear })} /> : null}
        </View>
        )}
        {/* 三天内有要自动记的周期账：提一句（没有就不出现） */}
        {!familyView && soon?.next ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Recurrings')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.md, backgroundColor: colors.fill }}
          >
            <RetroGlyph name="cycle" color={colors.ink2} px={iconSize.inline} />
            <Txt v="caption" muted numberOfLines={1} style={{ flex: 1 }}>
              {soonLabel(soon.next)}自动记 <Txt v="caption">{soon.note || soon.categoryName || '定时记账'}</Txt>
            </Txt>
            <Txt v="caption" color={soon.type === 'income' ? incomeColor : expenseColor}>
              {soon.type === 'income' ? '+' : '-'}
              {formatPlain(soon.amountCents)}
            </Txt>
          </Pressable>
        ) : null}
        <Ornament />
      </View>

      {/* 只有账目列表滚动 */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space.xs, paddingBottom: space.xxl, gap: space.xl }}
        refreshControl={canSync ? <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.active} colors={[colors.active]} /> : undefined}
      >
        {/* 账目只在这台手机上：记满 7 天后提一次开启云同步，× 关掉 30 天内不再提 */}
        {nudge && !familyView ? (
          <Section list>
            <ListRow
              title="账目只在这台手机上"
              subtitle={nudge === 'login' ? '登录开启云同步，换手机也不丢账' : '开启云同步，换手机也不丢账'}
              iconColor={colors.seal}
              glyph="letter"
              chevron={false}
              onPress={() => void openSync()}
              value={
                <Pressable accessibilityRole="button" accessibilityLabel="先不用，30 天内不再提" hitSlop={space.sm} onPress={snoozeNudge}>
                  <Icon as={X} size="inline" color={colors.ink3} />
                </Pressable>
              }
            />
          </Section>
        ) : null}

        {/* 家庭账本：创建者大掌柜到期 */}
        {familyView && fam.feed && !fam.feed.active ? (
          <Section list>
            <ListRow
              glyph="ingot"
              iconColor={colors.gold}
              title={`${VIP_NAME}到期了`}
              subtitle="家人新记的账暂时汇不进来，续费后会补上"
              onPress={() => useUi.getState().showVipSheet('family')}
            />
          </Section>
        ) : null}

        {familyView && fam.error === 'inactive' ? (
          <EmptyState
            glyph="tab-ledger"
            text={`「${family!.name}」创建者的${VIP_NAME}到期了，暂时看不到家庭账本。你自己的账照常记在我的账本里。`}
            action={<Button title="看我的账本" size="md" onPress={() => setFamilyView('')} />}
          />
        ) : familyView && !fam.feed && fam.error === 'network' ? (
          <EmptyState glyph="tab-ledger" text="没连上服务器，家庭账本暂时取不到，下拉再试试" />
        ) : familyView && !fam.feed ? null : shown.length === 0 && who ? (
          <EmptyState glyph="tab-ledger" text="这个月他还没有记账" action={<Button title="看全部" size="md" onPress={() => setWho(null)} />} />
        ) : shown.length === 0 ? (
          <EmptyState
            glyph="tab-ledger"
            text={familyView ? '这个月家里还没有账' : '这个月还没有记账'}
            action={<Button title="记一笔" variant="primary" size="md" onPress={() => navigation.navigate('EntryEdit', {})} />}
          />
        ) : (
          shown.map((g) => (
            <Animated.View key={g.date} entering={itemIn} exiting={itemOut} layout={itemLayout}>
              <Section
                list
                title={`${g.label}${g.expenseCents > 0 ? `　支出 ${formatPlain(g.expenseCents)}` : ''}${g.incomeCents > 0 ? `　收入 ${formatPlain(g.incomeCents)}` : ''}`}
              >
                {g.items.map((t) => (
                  <Animated.View key={t.id} entering={itemIn} exiting={itemOut} layout={itemLayout}>
                    {/* 家庭账本里：自己记的能编辑、左滑删除；家人记的只能看 */}
                    {!familyView || t.createdBy === myUserId ? (
                      <TxnRow t={t} who={familyView ? whoLabel(t, members) : undefined} navigation={navigation} />
                    ) : (
                      <TxnItem t={t} who={whoLabel(t, members)} />
                    )}
                  </Animated.View>
                ))}
              </Section>
            </Animated.View>
          ))
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  )
}
