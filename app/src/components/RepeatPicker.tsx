import { useRef, useState } from 'react'
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native'
import { colors, radius, size, space } from '../theme'
import { today } from '../utils/dates'
import { anchorOf, isoWeekday, type Freq, type Repeat } from '../utils/recurring'
import { Segmented } from './Chip'
import { PickMark } from './PickMark'
import { Txt } from './Txt'

const FREQ_LABEL: Record<Freq, string> = { day: '每天', week: '每周', month: '每月', year: '每年' }
const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
// 每年：这个月最多几号（2 月按 29，平年到时记 28 日）
const maxDay = (month: number) => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!

/**
 * 一个日子：和日历里的日子一个样子，选中的是朱文框。
 * 今天的星期、今天的几号、这个月不写数字，直接写“今天”“本月”（用户：黑色一般是没选中的样子，靠颜色分不清）
 */
function Dot({ label, a11y, on, onPress, wide, nowText }: { label: string; a11y: string; on: boolean; onPress: () => void; wide?: boolean; nowText?: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nowText ? `${a11y}，${nowText}` : a11y}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={({ pressed }) => ({
        minWidth: size.circle,
        height: size.circle,
        flex: wide ? 1 : undefined,
        paddingHorizontal: space.xs,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed && !on ? colors.fill : 'transparent',
      })}
    >
      {on ? <PickMark w={box.w} h={box.h} /> : null}
      {nowText ? (
        <Txt v="small" color={colors.seal} medium>
          {nowText}
        </Txt>
      ) : (
        <Txt v="body" color={colors.ink} medium={on}>
          {label}
        </Txt>
      )}
    </Pressable>
  )
}

/** 一排可以横着划的圆（几号、几月），打开时把选中的那个滚到中间 */
function Strip({ items, value, onPick, label, a11y, now, nowText }: { items: number[]; value: number; onPick: (v: number) => void; label: (v: number) => string; a11y: (v: number) => string; now?: number; nowText?: string }) {
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
        <Dot key={v} label={label(v)} a11y={a11y(v)} on={v === value} onPress={() => onPick(v)} nowText={v === now ? nowText : undefined} />
      ))}
    </ScrollView>
  )
}

/**
 * 选重复：每天 / 每周几 / 每月几号 / 每年几月几号（记一笔的日期面板、定时记账表单共用）。
 * value 为 null 是不重复（allowNone 才有这一项）；day、month 没选过时跟着 date 走（选的日子变了，几号也跟着变）。
 * 分段下面永远只占一排、高度固定：切换不重复 / 每天 / 每周 / 每月 / 每年时，下面的日历不跟着跳（用户：会抖）。
 * 每年把“几月”“几号”两条并排放在这一排里
 */
export function RepeatPicker({ value, onChange, date, allowNone }: { value: Repeat | null; onChange: (v: Repeat | null) => void; date: string; allowNone?: boolean }) {
  const options = [...(allowNone ? [{ value: 'none' as const, label: '不重复' }] : []), ...(['day', 'week', 'month', 'year'] as const).map((f) => ({ value: f, label: FREQ_LABEL[f] }))]
  const a = value ? anchorOf({ ...value, startDate: date }) : null
  const set = (more: Partial<Repeat>) => value && onChange({ ...value, ...more })
  const t = today()
  const nowDay = Number(t.slice(8))
  const nowMonth = Number(t.slice(5, 7))
  return (
    <View style={{ gap: space.sm }}>
      <Segmented options={options} value={value?.freq ?? 'none'} onChange={(f) => onChange(f === 'none' ? null : { freq: f, day: null, month: null })} />
      <View style={{ height: size.circle, justifyContent: 'center' }}>
      {!value || value.freq === 'day' ? (
        <Txt v="small" muted>
          {value ? '每天都自动记一笔' : '只记这一笔'}
        </Txt>
      ) : null}
      {value && a && value.freq === 'week' ? (
        <View style={{ flexDirection: 'row', gap: space.xxs }}>
          {WEEK.map((w, i) => (
            <Dot key={w} wide label={w} a11y={`每周${w}`} on={a.day === i + 1} onPress={() => set({ day: i + 1 })} nowText={isoWeekday(t) === i + 1 ? '今天' : undefined} />
          ))}
        </View>
      ) : null}
      {value && a && value.freq === 'month' ? <Strip items={range(31)} value={a.day} onPick={(day) => set({ day })} label={String} a11y={(d) => `每月 ${d} 号`} now={nowDay} nowText="今天" /> : null}
      {value && a && value.freq === 'year' ? (
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Strip
              items={range(12)}
              value={a.month}
              onPick={(month) => set({ month, day: Math.min(a.day, maxDay(month)) })}
              label={(m) => `${m}月`}
              a11y={(m) => `每年 ${m} 月`}
              now={nowMonth}
              nowText="本月"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Strip key={a.month} items={range(maxDay(a.month))} value={a.day} onPick={(day) => set({ day, month: a.month })} label={String} a11y={(d) => `${a.month} 月 ${d} 号`} now={a.month === nowMonth ? nowDay : undefined} nowText="今天" />
          </View>
        </View>
      ) : null}
      </View>
    </View>
  )
}
