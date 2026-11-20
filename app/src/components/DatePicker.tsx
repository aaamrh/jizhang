import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, SlideInLeft, SlideInRight, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import { colors, radius, size, space } from '../theme'
import { addDays, monthGrid, monthLabel, shiftMonth, today } from '../utils/dates'
import { Button } from './Button'
import { Icon } from './Icon'
import { ChevronDown, ChevronLeft, ChevronRight } from './icons/ui'
import { SPRING } from './motion'
import { PickMark } from './PickMark'
import { Sheet } from './Sheet'
import { Txt } from './Txt'

/**
 * 统一的日期 / 月份 / 年份选择：
 * 点标题逐级上翻（日 → 月 → 年），年份一页 12 个；‹ › 或左右滑动翻页。
 * 选日子：点了只是选中，按“确定”才定下、关面板（用户：别一按日期就关了）；底部“昨天”“今天”也只是选中。
 * 选月份、年份：点了就定（首页、盘账、年账跳转用）。
 */
type Level = 'day' | 'month' | 'year'
export type PickKind = Level

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const YEARS_PER_PAGE = 12
const SWIPE = 50 // 滑过这么远（或甩得够快）就翻页

/** 选中的那天是朱文框（用户从五种里选的），今天是数字下面一粒墨点 */
function Cell({ label, on, today: isToday, disabled, onPress, width }: { label: string; on?: boolean; today?: boolean; disabled?: boolean; onPress: () => void; width: `${number}%` }) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  return (
    <View style={{ width, alignItems: 'center', paddingVertical: space.xxs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on, disabled }}
        accessibilityLabel={`${label}${isToday ? '，今天' : ''}`}
        disabled={disabled}
        onPress={onPress}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={({ pressed }) => ({
          minWidth: size.circle,
          height: size.circle,
          paddingHorizontal: space.xs,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed && !on ? colors.fill : 'transparent',
          opacity: disabled ? 0.3 : 1,
        })}
      >
        {on ? <PickMark w={box.w} h={box.h} /> : null}
        <Txt v="body" color={colors.ink} medium={on}>
          {label}
        </Txt>
        {isToday && !on ? (
          <View style={{ position: 'absolute', bottom: space.xxs, width: size.todayDot, height: size.todayDot, borderRadius: size.todayDot / 2, backgroundColor: colors.ink }} />
        ) : null}
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
  /** 日历上面的内容（记一笔：“重复”一排）；传函数时拿到的是还没确定的那天，说明跟着变 */
  header?: ReactNode | ((draft: string) => ReactNode)
}

export function DatePickerSheet({ visible, onClose, kind, value, onChange, noFuture, header }: Props) {
  const now = today()
  const [level, setLevel] = useState<Level>(kind)
  const [month, setMonth] = useState(value.slice(0, 7) || now.slice(0, 7)) // 正在看的月
  const [yearPage, setYearPage] = useState(Number(value.slice(0, 4)))
  const [draft, setDraft] = useState(value) // 选日子时：点了还没确定的那天
  const [dir, setDir] = useState(1) // 上次往哪边翻，新的一页从那边滑进来
  const reduce = useReducedMotion()
  const tx = useSharedValue(0)

  useEffect(() => {
    if (!visible) return
    setLevel(kind)
    setMonth((kind === 'year' ? `${value}-01` : value).slice(0, 7))
    setYearPage(Number(value.slice(0, 4)))
    setDraft(value)
  }, [visible, kind, value])

  const year = Number(month.slice(0, 4))
  const chosen = kind === 'day' ? draft : value
  const pick = (v: string) => {
    onChange(v)
    onClose()
  }
  /** 选中某天（不关面板），日历翻到那个月 */
  const choose = (d: string) => {
    setDraft(d)
    setMonth(d.slice(0, 7))
    setLevel('day')
  }
  const future = (d: string) => !!noFuture && d > now

  // 标题与翻页
  const pageStart = yearPage - (((yearPage % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE)
  const title = level === 'day' ? monthLabel(month) : level === 'month' ? `${year}年` : `${pageStart} – ${pageStart + YEARS_PER_PAGE - 1}`
  const step = (n: number) => {
    setDir(n)
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

  // 左右滑动翻页：跟着手指挪一点，松手够远就翻，新的一页从那边滑进来；竖着拖留给面板下拉关闭
  const swipe = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      tx.value = e.translationX * 0.4
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE || Math.abs(e.velocityX) > 600) runOnJS(step)(e.translationX < 0 ? 1 : -1)
      tx.value = withSpring(0, SPRING)
    })
  const follow = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }))
  const pageKey = `${level}-${level === 'day' ? month : level === 'month' ? year : pageStart}`
  const enter = reduce ? undefined : (dir > 0 ? SlideInRight : SlideInLeft).duration(220)

  const arrow = (as: typeof ChevronLeft, n: number, label: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={space.sm} onPress={() => step(n)}>
      <Icon as={as} color={colors.ink2} />
    </Pressable>
  )

  return (
    <Sheet visible={visible} onClose={onClose} scroll={false}>
      <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
        {typeof header === 'function' ? header(draft) : header}
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

        <GestureDetector gesture={swipe}>
          <Animated.View style={[{ overflow: 'hidden' }, follow]}>
            <Animated.View key={pageKey} entering={enter}>
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
                        <Cell
                          key={d}
                          width={`${100 / 7}%`}
                          label={String(Number(d.slice(8)))}
                          on={d === chosen}
                          today={d === now}
                          disabled={future(d)}
                          onPress={() => (kind === 'day' ? setDraft(d) : pick(d))}
                        />
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
                    const sel = kind === 'month' ? value === m : chosen.slice(0, 7) === m
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
                        on={Number(chosen.slice(0, 4)) === y}
                        today={y === Number(now.slice(0, 4))}
                        disabled={future(`${y}-01-01`)}
                        onPress={() => (kind === 'year' ? pick(String(y)) : (setMonth(`${y}${month.slice(4)}`), setLevel('month')))}
                      />
                    )
                  })}
                </View>
              )}
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        {kind === 'day' ? (
          // 昨天、今天只是选中（不是红色主按钮，用户：今天不需要红色高亮）；确定才定下
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="昨天" size="md" style={{ flex: 1 }} disabled={future(addDays(now, -1))} onPress={() => choose(addDays(now, -1))} />
            <Button title="今天" size="md" style={{ flex: 1 }} onPress={() => choose(now)} />
            <Button title="确定" size="md" variant="ink" style={{ flex: 1 }} onPress={() => pick(draft)} />
          </View>
        ) : (
          <Button title={kind === 'month' ? '本月' : '今年'} size="md" onPress={() => pick(kind === 'month' ? now.slice(0, 7) : now.slice(0, 4))} />
        )}
      </View>
    </Sheet>
  )
}
