import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { colors, radius, size, space } from '../theme'
import { addDays, monthGrid, monthLabel, shiftMonth, today } from '../utils/dates'
import { Button } from './Button'
import { Icon } from './Icon'
import { ChevronDown, ChevronLeft, ChevronRight } from './icons/ui'
import { Sheet } from './Sheet'
import { Txt } from './Txt'

/**
 * 统一的日期 / 月份 / 年份选择：
 * 点标题逐级上翻（日 → 月 → 年），年份一页 12 个，‹ › 翻页；底部“今天/本月/今年”一键回到现在。
 */
type Level = 'day' | 'month' | 'year'
export type PickKind = Level

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const YEARS_PER_PAGE = 12

function Cell({ label, on, today: isToday, disabled, onPress, width }: { label: string; on?: boolean; today?: boolean; disabled?: boolean; onPress: () => void; width: `${number}%` }) {
  return (
    <View style={{ width, alignItems: 'center', paddingVertical: space.xxs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          minWidth: size.circle,
          height: size.circle,
          paddingHorizontal: space.xs,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: on ? colors.active : pressed ? colors.fill : 'transparent',
          borderWidth: isToday && !on ? 1 : 0,
          borderColor: colors.active,
          opacity: disabled ? 0.3 : 1,
        })}
      >
        <Txt v="body" color={on ? colors.white : colors.ink}>
          {label}
        </Txt>
      </Pressable>
    </View>
  )
}

interface Props {
  visible: boolean
  onClose: () => void
  /** 选到哪一级就结束：day 返回 'YYYY-MM-DD'，month 返回 'YYYY-MM'，year 返回 'YYYY' */
  kind: PickKind
  value: string
  onChange: (v: string) => void
  /** 不能选未来（按天比较） */
  noFuture?: boolean
  /** 日历上面的内容（记一笔：“重复”一排）；点它不关面板 */
  header?: ReactNode
}

export function DatePickerSheet({ visible, onClose, kind, value, onChange, noFuture, header }: Props) {
  const now = today()
  const [level, setLevel] = useState<Level>(kind)
  const [month, setMonth] = useState(value.slice(0, 7) || now.slice(0, 7)) // 正在看的月
  const [yearPage, setYearPage] = useState(Number(value.slice(0, 4)))

  useEffect(() => {
    if (!visible) return
    setLevel(kind)
    setMonth((kind === 'year' ? `${value}-01` : value).slice(0, 7))
    setYearPage(Number(value.slice(0, 4)))
  }, [visible, kind, value])

  const year = Number(month.slice(0, 4))
  const pick = (v: string) => {
    onChange(v)
    onClose()
  }
  const future = (d: string) => !!noFuture && d > now

  // 标题与翻页
  const pageStart = yearPage - (((yearPage % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE)
  const title = level === 'day' ? monthLabel(month) : level === 'month' ? `${year}年` : `${pageStart} – ${pageStart + YEARS_PER_PAGE - 1}`
  const step = (n: number) => {
    if (level === 'day') setMonth(shiftMonth(month, n))
    else if (level === 'month') setMonth(`${year + n}${month.slice(4)}`)
    else setYearPage(yearPage + n * YEARS_PER_PAGE)
  }
  const up = () => {
    if (level === 'day') setLevel('month')
    else if (level === 'month') {
      setYearPage(year)
      setLevel('year')
    }
  }

  const todayLabel = kind === 'day' ? '今天' : kind === 'month' ? '本月' : '今年'
  const jumpNow = () => pick(kind === 'day' ? now : kind === 'month' ? now.slice(0, 7) : now.slice(0, 4))

  const arrow = (as: typeof ChevronLeft, n: number, label: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={space.sm} onPress={() => step(n)}>
      <Icon as={as} color={colors.ink2} />
    </Pressable>
  )

  return (
    <Sheet visible={visible} onClose={onClose} scroll={false}>
      <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
        {header}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {arrow(ChevronLeft, -1, '上一页')}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}，点按选择${level === 'day' ? '月份' : '年份'}`}
            disabled={level === 'year'}
            onPress={up}
            hitSlop={space.sm}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}
          >
            <Txt v="h2">{title}</Txt>
            {level !== 'year' ? <Icon as={ChevronDown} size="inline" color={colors.ink2} /> : null}
          </Pressable>
          {arrow(ChevronRight, 1, '下一页')}
        </View>

        {level === 'day' ? (
          <View>
            <View style={{ flexDirection: 'row' }}>
              {WEEK.map((w) => (
                <Txt key={w} v="caption" muted center style={{ width: `${100 / 7}%` }}>
                  {w}
                </Txt>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthGrid(month).map((d, i) =>
                d ? (
                  <Cell key={d} width={`${100 / 7}%`} label={String(Number(d.slice(8)))} on={d === value} today={d === now} disabled={future(d)} onPress={() => pick(d)} />
                ) : (
                  <View key={`x${i}`} style={{ width: `${100 / 7}%` }} />
                ),
              )}
            </View>
          </View>
        ) : level === 'month' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: 12 }, (_, i) => {
              const m = `${year}-${String(i + 1).padStart(2, '0')}`
              const sel = kind === 'month' ? value === m : value.slice(0, 7) === m
              return (
                <Cell
                  key={m}
                  width="25%"
                  label={`${i + 1}月`}
                  on={sel}
                  today={m === now.slice(0, 7)}
                  disabled={future(`${m}-01`)}
                  onPress={() => (kind === 'month' ? pick(m) : (setMonth(m), setLevel('day')))}
                />
              )
            })}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: YEARS_PER_PAGE }, (_, i) => {
              const y = pageStart + i
              return (
                <Cell
                  key={y}
                  width="25%"
                  label={String(y)}
                  on={Number(value.slice(0, 4)) === y}
                  today={y === Number(now.slice(0, 4))}
                  disabled={future(`${y}-01-01`)}
                  onPress={() => (kind === 'year' ? pick(String(y)) : (setMonth(`${y}${month.slice(4)}`), setLevel('month')))}
                />
              )
            })}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {kind === 'day' ? <Button title="昨天" size="md" style={{ flex: 1 }} onPress={() => pick(addDays(now, -1))} /> : null}
          <Button title={`回到${todayLabel}`} size="md" variant="primary" style={{ flex: 1 }} onPress={jumpNow} />
        </View>
      </View>
    </Sheet>
  )
}
