import type { LucideIcon } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { colors, radius, size, space, type } from '../theme'
import { DatePickerSheet } from './DatePicker'
import { FeatureIcon, Icon } from './Icon'
import { RetroGlyph } from './RetroGlyph'
import { ChevronDown, ChevronLeft, ChevronRight, X } from './icons/ui'
import { Txt, type TxtVariant } from './Txt'
import { periodBlockText, type PeriodKind } from '../utils/dates'

/** 空状态：远山淡墨作底、前面一件器物，留白 + 一句话 + 可选按钮 */
export function EmptyState({ glyph, text, action }: { glyph?: string; text: string; action?: ReactNode }) {
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: 'center', gap: space.md }}>
      {glyph ? (
        <View style={{ width: size.empty, height: size.empty * 0.6, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ position: 'absolute', top: 0 }}>
            <RetroGlyph name="mountains" color={colors.hair} px={size.empty * 0.6} />
          </View>
          <FeatureIcon name={glyph} color={colors.ink2} large />
        </View>
      ) : null}
      <Txt muted center>
        {text}
      </Txt>
      {action}
    </View>
  )
}

/** 一组数字里的一项：小标签 + 衬线数值 */
export function Stat({
  label,
  value,
  v = 'h2',
  color,
  align = 'center',
}: {
  label: string
  value: string
  v?: TxtVariant
  color?: string
  align?: 'center' | 'left'
}) {
  return (
    <View style={{ flex: 1, alignItems: align === 'center' ? 'center' : 'flex-start', gap: space.xxs }}>
      <Txt v={v} color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      <Txt v="caption" muted>
        {label}
      </Txt>
    </View>
  )
}

/** ‹ 标签 ›：切换周、月、年 */
export function PeriodSwitcher({
  label,
  onPrev,
  onNext,
  nextDisabled,
  onPickLabel,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  nextDisabled?: boolean
  /** 点标题直接选（快速跳到任意年月） */
  onPickLabel?: () => void
}) {
  const arrow = (as: LucideIcon, onPress: () => void, a11y: string, disabled?: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={space.sm}
      onPress={onPress}
      style={{ opacity: disabled ? 0.3 : 1 }}
    >
      <Icon as={as} color={colors.ink2} />
    </Pressable>
  )
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      {arrow(ChevronLeft, onPrev, '上一个')}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={onPickLabel ? `${label}，点按选择` : label}
        disabled={!onPickLabel}
        hitSlop={space.sm}
        onPress={onPickLabel}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}
      >
        <Txt v="h2">{label}</Txt>
        {onPickLabel ? <Icon as={ChevronDown} size="inline" color={colors.ink2} /> : null}
      </Pressable>
      {arrow(ChevronRight, onNext, '下一个', nextDisabled)}
    </View>
  )
}

/** 流水页左上角：小字年份在上、大字月份在下，点开快速跳年月；aside 放在年份同一行（如账本切换） */
export function YearMonthBlock({ month, onChange, aside }: { month: string; onChange: (m: string) => void; aside?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const y = month.slice(0, 4)
  const m = Number(month.slice(5, 7))
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${y}年${m}月，切换月份`} hitSlop={space.xs} onPress={() => setOpen(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Txt v="small" muted>
            {y}年
          </Txt>
          {aside}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
          <Txt v="title">{m}月</Txt>
          <Icon as={ChevronDown} size="inline" color={colors.ink2} />
        </View>
      </Pressable>
      <DatePickerSheet visible={open} onClose={() => setOpen(false)} kind="month" value={month} onChange={onChange} />
    </>
  )
}

/** 盘账左上角的时间段，和流水的 YearMonthBlock 一个样子（小字在上、大字在下）。点开选日子 / 月份 / 年份；读屏可以上下滑动切到上一段、下一段（代替原来的左右箭头） */
export function PeriodBlock({
  kind,
  anchor,
  onPick,
  onShift,
  nextDisabled,
}: {
  kind: PeriodKind
  anchor: string
  onPick: () => void
  onShift: (n: 1 | -1) => void
  nextDisabled?: boolean
}) {
  const { small, big } = periodBlockText(kind, anchor)
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={`${small.replace(' · ', '，')}，${big}，点按选择`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'decrement') onShift(-1)
        else if (!nextDisabled) onShift(1)
      }}
      hitSlop={space.xs}
      onPress={onPick}
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      <Txt v="small" muted numberOfLines={1}>
        {small}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
        <Txt v="title" numberOfLines={1}>
          {big}
        </Txt>
        <Icon as={ChevronDown} size="inline" color={colors.ink2} />
      </View>
    </Pressable>
  )
}

/**
 * 一组收支数字里的一项：小标签在上，楷体数值在下。
 * scale：同一组里按最长的数值统一缩小（十几万、上百万都放得下，三个数字号一致）
 * onClear：标签换成一枚可以点掉的小胶囊（盘账筛了“非必要”时显示“非必要 ✕”，点了回到全部）；
 * 胶囊比标签高，所以数值都贴着底边，三个数字仍在一条线上
 */
export function MoneyStat({ label, value, color, scale = 1, onClear }: { label: string; value: string; color?: string; scale?: number; onClear?: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', gap: space.xxs, minWidth: 0 }}>
      {onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`只看${label}，点按看全部`}
          hitSlop={space.xs}
          onPress={onClear}
          style={({ pressed }) => [
            { height: size.chipSm, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: space.xs, paddingRight: space.xxs, borderRadius: radius.pill, backgroundColor: colors.fill },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Txt v="caption" numberOfLines={1}>
            {label}
          </Txt>
          <Icon as={X} size="inline" color={colors.ink2} />
        </Pressable>
      ) : (
        <Txt v="caption" muted numberOfLines={1}>
          {label}
        </Txt>
      )}
      <Txt
        v="h2"
        serif
        color={color}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={{ alignSelf: 'stretch', textAlign: 'right', fontSize: type.h2.fontSize * scale, lineHeight: type.h2.lineHeight }}
      >
        {value}
      </Txt>
    </View>
  )
}

/** 一组金额统一的缩放：最长的超过 9 个字符时按比例缩小 */
export const moneyScale = (...values: string[]) => Math.min(1, 9 / Math.max(...values.map((v) => v.length)))
