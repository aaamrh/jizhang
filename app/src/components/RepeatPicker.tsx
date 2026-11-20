import { useRef } from 'react'
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native'
import { colors, radius, size, space } from '../theme'
import { anchorOf, type Freq, type Repeat } from '../utils/recurring'
import { Segmented } from './Chip'
import { Txt } from './Txt'

const FREQ_LABEL: Record<Freq, string> = { day: '每天', week: '每周', month: '每月', year: '每年' }
const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
// 每年：这个月最多几号（2 月按 29，平年到时记 28 日）
const maxDay = (month: number) => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!

/** 一个圆：和日历里的日子一个样子，选中墨底 */
function Dot({ label, a11y, on, onPress, wide }: { label: string; a11y: string; on: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: size.circle,
        height: size.circle,
        flex: wide ? 1 : undefined,
        paddingHorizontal: space.xs,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: on ? colors.active : colors.fill,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt v="body" color={on ? colors.white : colors.ink}>
        {label}
      </Txt>
    </Pressable>
  )
}

/** 一排可以横着划的圆（几号、几月），打开时把选中的那个滚到中间 */
function Strip({ items, value, onPick, label, a11y }: { items: number[]; value: number; onPick: (v: number) => void; label: (v: number) => string; a11y: (v: number) => string }) {
  const ref = useRef<ScrollViewInstance>(null)
  const step = size.circle + space.xs
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.xs }}
      onLayout={(e) => ref.current?.scrollTo({ x: Math.max(0, (value - 1) * step - (e.nativeEvent.layout.width - size.circle) / 2), animated: false })}
    >
      {items.map((v) => (
        <Dot key={v} label={label(v)} a11y={a11y(v)} on={v === value} onPress={() => onPick(v)} />
      ))}
    </ScrollView>
  )
}

/**
 * 选重复：每天 / 每周几 / 每月几号 / 每年几月几号（记一笔的日期面板、周期账表单共用）。
 * value 为 null 是不重复（allowNone 才有这一项）；day、month 没选过时跟着 date 走（选的日子变了，几号也跟着变）
 */
export function RepeatPicker({ value, onChange, date, allowNone }: { value: Repeat | null; onChange: (v: Repeat | null) => void; date: string; allowNone?: boolean }) {
  const options = [...(allowNone ? [{ value: 'none' as const, label: '不重复' }] : []), ...(['day', 'week', 'month', 'year'] as const).map((f) => ({ value: f, label: FREQ_LABEL[f] }))]
  const a = value ? anchorOf({ ...value, startDate: date }) : null
  const set = (more: Partial<Repeat>) => value && onChange({ ...value, ...more })
  return (
    <View style={{ gap: space.sm }}>
      <Segmented options={options} value={value?.freq ?? 'none'} onChange={(f) => onChange(f === 'none' ? null : { freq: f, day: null, month: null })} />
      {value && a && value.freq === 'week' ? (
        <View style={{ flexDirection: 'row', gap: space.xxs }}>
          {WEEK.map((w, i) => (
            <Dot key={w} wide label={w} a11y={`每周${w}`} on={a.day === i + 1} onPress={() => set({ day: i + 1 })} />
          ))}
        </View>
      ) : null}
      {value && a && value.freq === 'month' ? <Strip items={range(31)} value={a.day} onPick={(day) => set({ day })} label={String} a11y={(d) => `每月 ${d} 号`} /> : null}
      {value && a && value.freq === 'year' ? (
        <>
          <Strip
            items={range(12)}
            value={a.month}
            onPick={(month) => set({ month, day: Math.min(a.day, maxDay(month)) })}
            label={(m) => `${m}月`}
            a11y={(m) => `每年 ${m} 月`}
          />
          <Strip key={a.month} items={range(maxDay(a.month))} value={a.day} onPick={(day) => set({ day, month: a.month })} label={String} a11y={(d) => `${a.month} 月 ${d} 号`} />
        </>
      ) : null}
    </View>
  )
}
