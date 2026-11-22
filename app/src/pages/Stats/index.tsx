import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { NecessityBar, RankRow, SpendBars } from '../../components/Bars'
import { CategoryIcon } from '../../components/CategoryIcon'
import { TextTabs } from '../../components/Chip'
import { EntriesSheet, type EntriesTarget } from '../../components/EntriesSheet'
import { LedgerSwitch } from '../../components/LedgerSwitch'
import { ListRow } from '../../components/ListRow'
import { TxnRow } from '../../components/TxnItem'
import { DatePickerSheet } from '../../components/DatePicker'
import { useCountUp } from '../../components/motion'
import { EmptyState, MoneyStat, moneyScale, PeriodBlock } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { Icon } from '../../components/Icon'
import { ChevronDown, ChevronRight } from '../../components/icons/ui'
import { useAllTags, useDailySpend, useFamilies, useMembers, usePeriodStats, usePeriodTags, useWeekReport } from '../../hooks/data'
import { useFamilyFeed, useFamilyPeriod } from '../../hooks/familyFeed'
import { useSettings } from '../../store/settingsStore'
import { amountColor, categoryColors, colors, necessityColors, size, space, tierColors } from '../../theme'
import type { TabProps } from '../../types/navigation'
import { monthOf, periodLabel, periodRange, shiftPeriod, today, weekStartOf, type PeriodKind } from '../../utils/dates'
import { VIP_NAME } from '../../utils/copy'
import { formatPlain, formatSigned, formatYuan } from '../../utils/money'
import { averageLabel, compareText, feedDailySpend, prevAverage, samePeriod, spendBuckets, sumSpend } from '../../utils/periodStats'
import { NECESSITIES, NECESSITY_LABEL, type Necessity } from '../../utils/necessity'

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

/** 头部左右滑多远算翻到上一段 / 下一段 */
const FLIP_X = 48

export default function StatsPage({ navigation, route }: TabProps<'Stats'>) {
  const { excludeAssets, setExcludeAssets } = useSettings()
  const [kind, setKind] = useState<PeriodKind>('month')
  const [anchor, setAnchor] = useState(today())
  // 周日提醒点进来：切到那一周（原来的周账页已并进这里）
  const week = route.params?.week
  useEffect(() => {
    if (!week) return
    setKind('week')
    setAnchor(week)
    navigation.setParams({ week: undefined }) // 同一天再点一次提醒也能再切过来
  }, [week, navigation])
  // 必要性筛选：不在顶上单放一排，点下面“钱花得必不必要”的色条来筛，再点一次或点支出旁的小叉回到全部
  const [filter, setFilter] = useState<Necessity | 'all'>('all')
  const [sheet, setSheet] = useState<EntriesTarget | null>(null)
  const s = usePeriodStats(kind, anchor, excludeAssets, filter)
  // 按标签：不受必要性筛选、不含家当影响；一笔两个标签两边都算，所以不显示占比
  const periodTags = usePeriodTags(kind, anchor).filter((g) => g.spendCents > 0)
  const hasTags = useAllTags().length > 0
  const { start, end } = periodRange(kind, anchor)
  const month = monthOf(start)
  // 家庭账本：一家人账的汇总，从服务器取（见 docs/需求.md 第 11 节）；必要性、不含家当、周账年账复盘只针对我的账本
  // 看哪个账本和流水是同一个开关（顶栏的账本名 ▾）
  const { viewed: family } = useFamilies()
  const familyView = !!family
  // 周视图另有：记了几天、最大的一笔（只看我的账本）
  const wk = useWeekReport(kind === 'week' && !familyView ? weekStartOf(anchor) : null)
  const members = useMembers(family?.id)
  const fs = useFamilyPeriod(familyView ? family!.id : null, start, end, members)
  const isLatest = end > today()
  const maxCat = s.categories[0]?.cents ?? 0
  const [picking, setPicking] = useState(false)
  const [why, setWhy] = useState(false)
  const summary = familyView ? fs.summary : s
  const filtered = filter !== 'all' && !familyView
  const filterName = filtered ? NECESSITY_LABEL[filter as Necessity] : ''

  // 和上一段比、日均、柱状图都用“每天花了多少”：我的账本查本机，家庭账本用服务器给的账。
  // 同期：没过完的段拿“到今天”比上一段“同样多天”（半段比整段没有意义）；上一段取整段，柱状图的虚线要它的日均
  const sp = samePeriod(kind, anchor)
  const myRows = useDailySpend(start, end, excludeAssets, filter)
  const myPrevRows = useDailySpend(sp.prevFull.start, sp.prevFull.end, excludeAssets, filter)
  const famPrev = useFamilyFeed(familyView ? family!.id : null, sp.prevFull.start, sp.prevFull.end)
  const rows = familyView ? feedDailySpend(fs.feed?.items ?? []) : myRows
  const prevRows = familyView ? feedDailySpend(famPrev.feed?.items ?? []) : myPrevRows
  const curSame = sumSpend(rows, sp.cur.end)
  // 日均取整到元（¥4,129.94 这种零头没有意义）
  const daily = Math.round(curSame / sp.days / 100) * 100
  const cmp = compareText(kind, curSame, sumSpend(prevRows, sp.prev.end), sp.complete, filterName)
  const buckets = spendBuckets(kind, anchor, rows)
  const avg = prevAverage(kind, sp.prevFull, sumSpend(prevRows))

  const exp = useCountUp(summary.expenseCents)
  const inc = useCountUp(summary.incomeCents)
  const bal = useCountUp(summary.balanceCents)
  // 全部支出（不分必要性）：三类加起来，筛选时放在第二栏当参照
  const allSpend = NECESSITIES.reduce((a, k) => a + s.necessity[k], 0)
  // 头部右边的几栏（金额 0 用墨色）：
  // - 筛选时只说这一类：「非必要 ✕」和「全部支出」，不放收入、结余（和筛选无关，放一起容易被拿来加减）
  // - 周：工资多按月发，一周的收入、结余没意义，换成「日均」和「记账天数」
  // - 月、年：支出、收入、结余，和流水一样
  type Col = { label: string; value: string; color?: string; onClear?: () => void }
  const spendCol: Col = {
    label: filtered ? filterName : excludeAssets && !familyView ? '支出·不含家当' : '支出',
    value: formatPlain(exp),
    color: amountColor(-summary.expenseCents),
    onClear: filtered ? () => setFilter('all') : undefined,
  }
  const cols: Col[] = filtered
    ? [spendCol, { label: '全部支出', value: formatPlain(allSpend), color: amountColor(-allSpend) }]
    : kind === 'week'
      ? [spendCol, { label: '日均', value: formatPlain(daily), color: amountColor(-daily) }, ...(wk ? [{ label: '记账天数', value: `${wk.recordDays}/${sp.days}` }] : [])]
      : [
          spendCol,
          { label: '收入', value: formatPlain(inc), color: amountColor(summary.incomeCents) },
          { label: '结余', value: formatSigned(bal), color: amountColor(summary.balanceCents) },
        ]
  const scale = moneyScale(...cols.map((c) => c.value))
  // 头部下面一行：比上一段同期；日均不在栏里时写在这里（一分没花就不写日均）
  const insight = [cmp, curSame > 0 && cols.every((c) => c.label !== '日均') ? `日均 ${formatYuan(daily)}` : null].filter(Boolean).join(' · ')

  // 柱状图：周、月每天一根，年每月一根；筛选时用这一类的颜色。家庭账本的账不在本机，点柱子看不了明细
  const unit = kind === 'year' ? '每月' : '每天'
  const chart = buckets.some((b) => b.cents > 0) ? (
    <Section title={`${filtered ? `${unit}的${filterName}支出` : `${unit}花了多少`}${familyView ? '' : kind === 'year' ? ' · 点柱子看那个月' : ' · 点柱子看那天'}`}>
      <SpendBars
        bars={buckets}
        color={filtered ? necessityColors[filter as Necessity] : colors.ink2}
        avgCents={avg}
        avgLabel={`${averageLabel(kind)} ${formatYuan(avg)}`}
        onPick={
          familyView
            ? undefined
            : (b) => setSheet({ label: b.name, period: periodLabel(kind, anchor), start: b.start, end: b.end, categoryId: null, necessity: filter, excludeAssets })
        }
      />
    </Section>
  ) : null
  // 周：选周的日历（点哪天都框住整周，返回那周周一）
  const pickKind = kind
  const pickValue = kind === 'week' ? anchor : kind === 'month' ? anchor.slice(0, 7) : anchor.slice(0, 4)

  const shift = (n: 1 | -1) => {
    if (n === 1 && isLatest) return
    setAnchor(shiftPeriod(kind, anchor, n))
  }
  // 头部左右滑：往左是下一段、往右是上一段（代替原来的左右箭头）；先竖着动就交给列表滚动
  const flip = Gesture.Pan()
    .activeOffsetX([-space.lg, space.lg])
    .failOffsetY([-space.sm, space.sm])
    .onEnd((e) => {
      if (e.translationX <= -FLIP_X) runOnJS(shift)(1)
      else if (e.translationX >= FLIP_X) runOnJS(shift)(-1)
    })

  // 头部和流水一个骨架：顶栏居中账本名 ▾（右边是 周 · 月 · 年）；下面左边时间段、右边几栏金额；再下面一行和上一段比
  const header = (
    <>
      <View style={{ height: size.navBar - space.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <LedgerSwitch onManage={() => navigation.navigate('Ledgers')} maxWidth="50%" />
        <View style={{ position: 'absolute', right: 0 }}>
          <TextTabs
            options={KINDS}
            value={kind}
            onChange={(k) => {
              setKind(k)
              setAnchor(today())
            }}
          />
        </View>
      </View>
      <GestureDetector gesture={flip}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
          <PeriodBlock kind={kind} anchor={anchor} onPick={() => setPicking(true)} onShift={shift} nextDisabled={isLatest} />
          <View style={{ flex: 1, flexDirection: 'row', gap: space.sm, paddingBottom: space.xxs }}>
            {cols.map((c) => (
              <MoneyStat key={c.label} label={c.label} value={c.value} color={c.color} scale={scale} onClear={c.onClear} />
            ))}
          </View>
        </View>
      </GestureDetector>
      {insight ? (
        <Txt v="caption" muted>
          {insight}
        </Txt>
      ) : null}
      <DatePickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        kind={pickKind}
        value={pickValue}
        noFuture
        onChange={(v) => setAnchor(kind === 'week' ? v : kind === 'month' ? `${v}-01` : `${v}-01-01`)}
      />
    </>
  )

  return (
    <Screen edges={['top']} header={header}>
      {familyView ? (
        fs.error === 'inactive' ? (
          <EmptyState glyph="tab-abacus" text={`「${family!.name}」创建者的${VIP_NAME}到期了，暂时看不到家庭账本`} />
        ) : !fs.feed ? (
          fs.error ? <EmptyState glyph="tab-abacus" text="没连上服务器，家庭账本暂时取不到" /> : null
        ) : fs.count === 0 ? (
          <EmptyState glyph="tab-abacus" text="这段时间家里还没有账" />
        ) : (
          <>
            {chart}
            {fs.categories.length > 0 ? (
              <Section title="分类排行">
                <View style={{ gap: space.md }}>
                  {fs.categories.slice(0, 10).map((c) => (
                    <RankRow
                      key={c.name}
                      label={c.name}
                      cents={c.cents}
                      max={fs.categories[0]!.cents}
                      total={fs.summary.expenseCents}
                      color={categoryColors[c.color]}
                      leading={<CategoryIcon icon={c.icon} color={c.color} />}
                    />
                  ))}
                </View>
              </Section>
            ) : null}
            {fs.byMember.length > 0 ? (
              <Section title="谁记了多少">
                <View style={{ gap: space.md }}>
                  {fs.byMember.map((m) => (
                    <RankRow key={m.key} label={m.name} cents={m.cents} max={fs.byMember[0]!.cents} total={fs.summary.expenseCents} color={tierColors.need} />
                  ))}
                </View>
              </Section>
            ) : null}
          </>
        )
      ) : (
        <>
      {s.txnCount === 0 ? (
          <EmptyState glyph="tab-abacus" text="这段时间还没有记账" />
        ) : (
          <>
            {chart}

            <Section title="钱花得必不必要 · 点一段只看这类">
              <NecessityBar parts={s.necessity} selected={filter === 'all' ? null : filter} onPick={(k) => setFilter((f) => (f === k ? 'all' : k))} />
              {/* 口径说明第一次看有用，以后每次占三行：收起来，点开再看 */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: why }}
                hitSlop={space.xs}
                onPress={() => setWhy((v) => !v)}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }, pressed && { opacity: 0.6 }]}
              >
                <Txt v="caption" muted style={{ flexShrink: 1 }}>
                  {why
                    ? '细算过的按标记算；没标记的，必需类算必要，享受类算非必要，弹性类待定'
                    : `怎么算的${s.reviewed > 0 ? ` · 已细算 ${s.reviewed} 笔` : ''}`}
                </Txt>
                {why ? null : <Icon as={ChevronDown} size="inline" color={colors.ink2} />}
              </Pressable>
            </Section>
  
            {s.categories.length > 0 ? (
              <Section title={filter === 'all' ? '分类排行 · 点开看每一笔' : `${NECESSITY_LABEL[filter]}支出的分类 · 点开看每一笔`}>
                <View style={{ gap: space.md }}>
                  {s.categories.slice(0, 10).map((c) => (
                    <RankRow
                      key={c.categoryId}
                      label={c.name}
                      cents={c.cents}
                      max={maxCat}
                      total={s.expenseCents}
                      color={categoryColors[c.color]}
                      leading={<CategoryIcon icon={c.icon} color={c.color} />}
                      onPress={() => setSheet({ label: c.name, period: periodLabel(kind, anchor), start, end, categoryId: c.categoryId, necessity: filter, excludeAssets })}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            {wk?.largest ? (
              <Section list title="最大的一笔">
                <TxnRow t={wk.largest} navigation={navigation} />
              </Section>
            ) : null}

            {hasTags && filter === 'all' ? (
              <Section title="按标签 · 点开看这个标签的所有账">
                {periodTags.length ? (
                  <View style={{ gap: space.md }}>
                    {periodTags.slice(0, 10).map((g) => (
                      <RankRow
                        key={g.name}
                        label={g.name}
                        cents={g.spendCents}
                        max={periodTags[0]!.spendCents}
                        total={0}
                        color={colors.ink3}
                        onPress={() => navigation.navigate('Tag', { name: g.name })}
                      />
                    ))}
                  </View>
                ) : (
                  <Txt v="small" muted>
                    这段时间的账没带标签
                  </Txt>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Txt v="caption" muted>
                    一笔带两个标签，两个标签里都算
                  </Txt>
                  <Pressable accessibilityRole="button" hitSlop={space.sm} onPress={() => navigation.navigate('Tags')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Txt v="small" muted>
                      全部标签
                    </Txt>
                    <Icon as={ChevronRight} size="inline" color={colors.ink2} />
                  </Pressable>
                </View>
              </Section>
            ) : null}
          </>
        )}
  
        <Section list>
          <ListRow
            title="不含家当"
            subtitle="去掉买东西计入家当的支出，只看日常消费"
            switchValue={excludeAssets}
            onSwitch={setExcludeAssets}
          />
        </Section>
  
        <Section list title="回顾">
          <ListRow glyph="thread-book" title="年账" subtitle="一整年的收支、家当、记账天数" onPress={() => navigation.navigate('YearReport', {})} />
          <ListRow glyph="seal" title="细算" subtitle={`${month.slice(5, 7).replace(/^0/, '')}月的花销，一笔笔看看值不值`} onPress={() => navigation.navigate('Review', { month })} />
        </Section>
        </>
      )}

      <EntriesSheet target={sheet} onClose={() => setSheet(null)} />
    </Screen>
  )
}
