import { useMemo, useState } from 'react'
import { Pressable, useWindowDimensions, View } from 'react-native'
import { Button } from '../../components/Button'
import { EmptyState, PeriodSwitcher } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TxnRow } from '../../components/TxnItem'
import { Txt } from '../../components/Txt'
import { useMonthView } from '../../hooks/data'
import { colors, expenseColor, GUTTER, incomeColor, radius, space } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { addDays, dayLabel, monthOf, shiftMonth, today } from '../../utils/dates'
import { formatPlain } from '../../utils/money'

const WEEK = ['一', '二', '三', '四', '五', '六', '日']

/**
 * 记账日历（大掌柜）：一个月一屏，每天格子里写当天支出（有收入再写一行绿字）；
 * 点某一天，下面列出那天的账，可以“补记这天”。只看我的账本。
 */
export default function CalendarPage({ navigation }: StackProps<'Calendar'>) {
  const now = today()
  const [month, setMonth] = useState(monthOf(now))
  const [picked, setPicked] = useState(now)
  const { width } = useWindowDimensions()
  const { summary, groups } = useMonthView(month, false)
  const byDay = useMemo(() => new Map(groups.map((g) => [g.date, g])), [groups])

  const [y, m] = month.split('-').map(Number) as [number, number]
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 // 周一在最前
  const cell = Math.floor((width - GUTTER * 2) / 7)
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => addDays(`${month}-01`, i))]

  const switchMonth = (n: number) => {
    const next = shiftMonth(month, n)
    setMonth(next)
    setPicked(next === monthOf(now) ? now : `${next}-01`)
  }
  const day = byDay.get(picked)

  return (
    <Screen>
      <PeriodSwitcher label={`${y}年${m}月`} onPrev={() => switchMonth(-1)} onNext={() => switchMonth(1)} nextDisabled={month >= monthOf(now)} />
      <Txt v="small" muted center>
        这个月支出 <Txt v="small" color={expenseColor}>{formatPlain(summary.expenseCents)}</Txt>　收入{' '}
        <Txt v="small" color={incomeColor}>
          {formatPlain(summary.incomeCents)}
        </Txt>
      </Txt>

      <Section>
        <View style={{ flexDirection: 'row' }}>
          {WEEK.map((w) => (
            <Txt key={w} v="caption" faint center style={{ width: cell - space.xxs }}>
              {w}
            </Txt>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            if (!d) return <View key={`b${i}`} style={{ width: cell - space.xxs, height: cell }} />
            const g = byDay.get(d)
            const on = d === picked
            const future = d > now
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: future }}
                accessibilityLabel={`${dayLabel(d)}${g?.expenseCents ? `，支出 ${formatPlain(g.expenseCents)}` : ''}`}
                disabled={future}
                onPress={() => setPicked(d)}
                style={{ width: cell - space.xxs, height: cell, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: on ? colors.active : 'transparent' }}
              >
                <Txt v="body" color={on ? colors.white : future ? colors.ink3 : colors.ink} medium={d === now}>
                  {Number(d.slice(8))}
                </Txt>
                {/* 没账的日子也占着这一行，格子高度不跳 */}
                <Txt v="caption" numberOfLines={1} color={on ? colors.white : g?.expenseCents ? expenseColor : incomeColor} style={{ opacity: g && (g.expenseCents || g.incomeCents) ? 1 : 0 }}>
                  {g?.expenseCents ? formatPlain(g.expenseCents) : g?.incomeCents ? `+${formatPlain(g.incomeCents)}` : '0'}
                </Txt>
              </Pressable>
            )
          })}
        </View>
      </Section>

      <Section
        list
        title={`${dayLabel(picked)}${day?.expenseCents ? `　支出 ${formatPlain(day.expenseCents)}` : ''}${day?.incomeCents ? `　收入 ${formatPlain(day.incomeCents)}` : ''}`}
      >
        {day?.items.length ? day.items.map((t) => <TxnRow key={t.id} t={t} navigation={navigation} />) : null}
      </Section>
      {day?.items.length ? null : <EmptyState glyph="tab-ledger" text="这天没有记账" />}
      <Button title={picked === now ? '记一笔' : `补记 ${dayLabel(picked)}`} variant="primary" onPress={() => navigation.navigate('EntryEdit', { date: picked })} />
    </Screen>
  )
}
