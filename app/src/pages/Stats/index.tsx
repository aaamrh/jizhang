import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { NecessityBar, RankRow } from '../../components/Bars'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Segmented } from '../../components/Chip'
import { EntriesSheet, type EntriesTarget } from '../../components/EntriesSheet'
import { ListRow } from '../../components/ListRow'
import { TxnRow } from '../../components/TxnItem'
import { DatePickerSheet } from '../../components/DatePicker'
import { useCountUp } from '../../components/motion'
import { EmptyState, PeriodSwitcher, Stat } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { Icon } from '../../components/Icon'
import { ChevronRight } from '../../components/icons/ui'
import { useAllTags, useFamilies, useMembers, usePeriodStats, usePeriodTags, useWeekReport } from '../../hooks/data'
import { useFamilyPeriod } from '../../hooks/familyFeed'
import { useSettings } from '../../store/settingsStore'
import { amountColor, categoryColors, colors, expenseColor, incomeColor, space, tierColors } from '../../theme'
import type { TabProps } from '../../types/navigation'
import { monthOf, periodLabel, periodRange, shiftPeriod, today, weekStartOf, type PeriodKind } from '../../utils/dates'
import { VIP_NAME } from '../../utils/copy'
import { formatPlain, formatSigned, formatYuan } from '../../utils/money'
import { NECESSITY_FILTERS, NECESSITY_LABEL, type Necessity } from '../../utils/necessity'

/** 和上一周比：只陈述，不评判；口径和上面的支出一样（同样的必要性筛选、不含家当） */
function compare(cur: number, prev: number) {
  if (prev <= 0) return null
  const d = cur - prev
  if (d === 0) return '和上周持平'
  return d < 0 ? `比上周少花 ${formatYuan(-d)}` : `比上周多花 ${formatYuan(d)}`
}

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

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
  const [filter, setFilter] = useState<Necessity | 'all'>('all')
  const [sheet, setSheet] = useState<EntriesTarget | null>(null)
  const s = usePeriodStats(kind, anchor, excludeAssets, filter)
  const prev = usePeriodStats(kind, shiftPeriod(kind, anchor, -1), excludeAssets, filter)
  // 按标签：不受必要性筛选、不含家当影响；一笔两个标签两边都算，所以不显示占比
  const periodTags = usePeriodTags(kind, anchor).filter((g) => g.spendCents > 0)
  const hasTags = useAllTags().length > 0
  const { start, end } = periodRange(kind, anchor)
  const month = monthOf(periodRange(kind, anchor).start)
  // 家庭账本：一家人账的汇总，从服务器取（见 docs/需求.md 第 11 节）；必要性、不含家当、周账年账复盘只针对我的账本
  const { families, viewed: family } = useFamilies()
  const familyView = !!family
  // 周视图另有：比上周、记了几天、最大的一笔（只看我的账本）
  const wk = useWeekReport(kind === 'week' && !familyView ? weekStartOf(anchor) : null)
  const cmp = wk ? compare(s.expenseCents, prev.expenseCents) : null
  const setFamilyView = useSettings((st) => st.setFamilyView)
  const members = useMembers(family?.id)
  const fs = useFamilyPeriod(familyView ? family!.id : null, start, end, members)
  const isLatest = periodRange(kind, anchor).end > today()
  const maxCat = s.categories[0]?.cents ?? 0
  const [picking, setPicking] = useState(false)
  const exp = useCountUp(familyView ? fs.summary.expenseCents : s.expenseCents)
  const inc = useCountUp(familyView ? fs.summary.incomeCents : s.incomeCents)
  const bal = useCountUp(familyView ? fs.summary.balanceCents : s.balanceCents)
  const pickKind = kind === 'week' ? 'day' : kind
  const pickValue = kind === 'week' ? anchor : kind === 'month' ? anchor.slice(0, 7) : anchor.slice(0, 4)

  return (
    <Screen edges={['top']}>
      <View style={{ gap: space.md }}>
        {families.length ? (
          <Segmented
            options={[{ value: '', label: '我的账本' }, ...families.map((f) => ({ value: f.id, label: f.name }))]}
            value={family?.id ?? ''}
            onChange={setFamilyView}
          />
        ) : null}
        <Segmented
          options={KINDS}
          value={kind}
          onChange={(k) => {
            setKind(k)
            setAnchor(today())
          }}
        />
        {familyView ? null : <Segmented options={NECESSITY_FILTERS} value={filter} onChange={setFilter} />}
        <PeriodSwitcher
          label={periodLabel(kind, anchor)}
          onPrev={() => setAnchor(shiftPeriod(kind, anchor, -1))}
          onNext={() => setAnchor(shiftPeriod(kind, anchor, 1))}
          nextDisabled={isLatest}
          onPickLabel={() => setPicking(true)}
        />
        <DatePickerSheet
          visible={picking}
          onClose={() => setPicking(false)}
          kind={pickKind}
          value={pickValue}
          noFuture
          onChange={(v) => setAnchor(kind === 'week' ? v : kind === 'month' ? `${v}-01` : `${v}-01-01`)}
        />
      </View>

      <Section>
        <View style={{ flexDirection: 'row' }}>
          <Stat label={filter === 'all' || familyView ? '支出' : `${NECESSITY_LABEL[filter]}支出`} value={formatPlain(exp)} v="title" color={expenseColor} />
          <Stat label="收入" value={formatPlain(inc)} v="title" color={incomeColor} />
          <Stat label="结余" value={formatSigned(bal)} v="title" color={amountColor(bal)} />
        </View>
        {wk ? (
          <Txt v="small" muted center>
            {[cmp, `记了 ${wk.recordDays} / 7 天`].filter(Boolean).join(' · ')}
          </Txt>
        ) : null}
      </Section>

      {familyView ? (
        fs.error === 'inactive' ? (
          <EmptyState glyph="tab-abacus" text={`「${family!.name}」创建者的${VIP_NAME}到期了，暂时看不到家庭账本`} />
        ) : !fs.feed ? (
          fs.error ? <EmptyState glyph="tab-abacus" text="没连上服务器，家庭账本暂时取不到" /> : null
        ) : fs.count === 0 ? (
          <EmptyState glyph="tab-abacus" text="这段时间家里还没有账" />
        ) : (
          <>
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
            <Section title="钱花得必不必要">
              <NecessityBar parts={s.necessity} onPick={setFilter} />
              <Txt v="caption" muted>
                复盘标记过的按标记算；没标记的，必需类算必要，享受类算非必要，弹性类待定{s.reviewed > 0 ? `。已复盘 ${s.reviewed} 笔` : ''}
              </Txt>
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
          <ListRow glyph="seal" title="复盘" subtitle={`回头看看${month.slice(5, 7).replace(/^0/, '')}月的花销：必要还是非必要`} onPress={() => navigation.navigate('Review', { month })} />
        </Section>
        </>
      )}

      <EntriesSheet target={sheet} onClose={() => setSheet(null)} />
    </Screen>
  )
}
