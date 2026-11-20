import { useState } from 'react'
import { Segmented } from '../../components/Chip'
import { EntriesSheet, type EntriesTarget } from '../../components/EntriesSheet'
import { View } from 'react-native'
import { MonthBars, RankRow, NecessityBar } from '../../components/Bars'
import { CategoryIcon } from '../../components/CategoryIcon'
import { DatePickerSheet } from '../../components/DatePicker'
import { EmptyState, PeriodSwitcher, Stat } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { useYearReport } from '../../hooks/data'
import { amountColor, categoryColors, colors, expenseColor, incomeColor } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { NECESSITY_FILTERS, NECESSITY_LABEL, type Necessity } from '../../utils/necessity'
import { today } from '../../utils/dates'
import { formatPlain, formatSigned, formatYuan } from '../../utils/money'

export default function YearReportPage({ route }: StackProps<'YearReport'>) {
  const [filter, setFilter] = useState<Necessity | 'all'>('all')
  const [sheet, setSheet] = useState<EntriesTarget | null>(null)
  const thisYear = Number(today().slice(0, 4))
  const [year, setYear] = useState(route.params?.year ?? thisYear)
  const r = useYearReport(year, filter)
  const yStart = `${year}-01-01`
  const yEnd = `${year + 1}-01-01`
  const open = (label: string, categoryId: string | null, necessity: Necessity | 'all') =>
    setSheet({ label, period: `${year}年`, start: yStart, end: yEnd, categoryId, necessity })
  const openMonth = (m: string) => {
    const next = Number(m.slice(5)) === 12 ? `${year + 1}-01-01` : `${year}-${String(Number(m.slice(5)) + 1).padStart(2, '0')}-01`
    setSheet({ label: `${Number(m.slice(5))}月`, period: `${year}年`, start: `${m}-01`, end: next, categoryId: null, necessity: filter })
  }
  const { summary } = r
  const top = summary.categories.slice(0, 5)
  const [picking, setPicking] = useState(false)

  return (
    <Screen>
      <Segmented options={NECESSITY_FILTERS} value={filter} onChange={setFilter} />
      <PeriodSwitcher label={`${year}年`} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} nextDisabled={year >= thisYear} onPickLabel={() => setPicking(true)} />
      <DatePickerSheet visible={picking} onClose={() => setPicking(false)} kind="year" value={String(year)} noFuture onChange={(v) => setYear(Number(v))} />

      {summary.txnCount === 0 ? (
        <EmptyState glyph="thread-book" text="这一年还没有记账" />
      ) : (
        <>
          <Section>
            <View style={{ flexDirection: 'row' }}>
              <Stat label={filter === 'all' ? '全年支出' : `${NECESSITY_LABEL[filter]}支出`} value={formatPlain(summary.expenseCents)} v="title" color={expenseColor} />
              <Stat label="收入" value={formatPlain(summary.incomeCents)} v="title" color={incomeColor} />
              <Stat label="结余" value={formatSigned(summary.balanceCents)} v="title" color={amountColor(summary.balanceCents)} />
            </View>
          </Section>

          <Section title="每月支出 · 点柱子看那个月的每一笔">
            <MonthBars months={r.months} onPick={openMonth} />
          </Section>

          {summary.expenseCents > 0 ? (
            <Section title="钱花得必不必要">
              <NecessityBar parts={summary.necessity} onPick={(n) => open(NECESSITY_LABEL[n], null, n)} />
              {summary.reviewed > 0 ? (
                <Txt v="small" muted>
                  这一年细算过 {summary.reviewed} 笔
                </Txt>
              ) : null}
            </Section>
          ) : null}

          {top.length > 0 ? (
            <Section title="花得最多的 5 类 · 点开看每一笔">
              {top.map((c) => (
                <RankRow
                  key={c.categoryId}
                  label={c.name}
                  cents={c.cents}
                  max={top[0]!.cents}
                  total={summary.expenseCents}
                  color={categoryColors[c.color]}
                  leading={<CategoryIcon icon={c.icon} color={c.color} />}
                  onPress={() => open(c.name, c.categoryId, filter)}
                />
              ))}
            </Section>
          ) : null}

          <Section title="家当">
            <Txt>这一年添了 {r.assetsAdded} 件家当</Txt>
            {r.bestAsset ? (
              <Txt v="small" muted>
                最值的是「{r.bestAsset.name}」：用了 {r.bestAsset.days} 天，日均 {formatYuan(r.bestAsset.perDayCents)}
              </Txt>
            ) : null}
          </Section>

          <Section>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="记账天数" value={`${r.recordDays}`} v="title" />
              <Stat label="最长连续" value={`${r.longestStreak}`} v="title" />
            </View>
          </Section>
        </>
      )}
      <EntriesSheet target={sheet} onClose={() => setSheet(null)} />
    </Screen>
  )
}
