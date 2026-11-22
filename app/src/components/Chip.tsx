import type { LucideIcon } from 'lucide-react-native'
import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import { colors, iconSize, radius, shadow, size, space, tint } from '../theme'
import { Icon } from './Icon'
import { Check, ChevronDown } from './icons/ui'
import { SPRING } from './motion'
import { RetroGlyph } from './RetroGlyph'
import { Txt } from './Txt'

/** 胶囊：高 32（small 高 22，用在列表行里，如账目上的标签）。selected 时墨底；可带左侧图标 */
export function Chip({
  label,
  onPress,
  onLongPress,
  selected,
  icon,
  glyph,
  leading,
  small,
}: {
  label: string
  onPress?: () => void
  onLongPress?: () => void
  selected?: boolean
  icon?: LucideIcon
  /** 左侧自绘复古图标 */
  glyph?: string
  leading?: ReactNode
  small?: boolean
}) {
  const fg = selected ? colors.surface : colors.ink
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        {
          height: small ? size.chipSm : size.chip,
          paddingHorizontal: small ? space.xs : space.sm,
          borderRadius: radius.pill,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xxs,
          backgroundColor: selected ? colors.active : colors.fill,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      {leading}
      {glyph ? <RetroGlyph name={glyph} color={fg} px={iconSize.inline} /> : icon ? <Icon as={icon} size="inline" color={fg} /> : null}
      <Txt v={small ? 'caption' : 'small'} color={fg} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  )
}

/**
 * 图标胶囊（记一笔第二行的标签、照片）：只放一个图标表示含义（参照鲨鱼记账），读屏念 label。
 * 有内容时淡墨底（同勾选胶囊勾上），图标后面跟着内容：选了的标签名、照片缩略图
 */
export function IconChip({ glyph, label, active, onPress, children }: { glyph: string; label: string; active?: boolean; onPress: () => void; children?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: size.chip,
          minWidth: size.chip + space.sm,
          maxWidth: size.chip * 6,
          paddingHorizontal: space.sm,
          borderRadius: radius.pill,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.xs,
          backgroundColor: active ? tint(colors.active, 0.08) : colors.fill,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <RetroGlyph name={glyph} color={colors.ink} px={iconSize.list} />
      {children}
    </Pressable>
  )
}

/**
 * 选择器胶囊（钱袋…）：描边 + "名称 值 ▾"，一看就知道点了会弹出选项。
 * 和勾选胶囊 CheckChip 高度、内边距一致，样式区分开。
 */
/** 点开选的胶囊：图标 + 标签 + 当前值 ▾，和勾选胶囊同样的浅底，能放在同一行。标签可以不写（只留图标和值，比如钱袋） */
export function SelectChip({ label, value, glyph, onPress }: { label?: string; value: string; glyph?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label ?? ''}${label ? '：' : ''}${value}，点按更换`}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: size.chip,
          paddingLeft: space.sm,
          paddingRight: space.xs,
          borderRadius: radius.pill,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xxs,
          backgroundColor: colors.fill,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      {glyph ? <RetroGlyph name={glyph} color={colors.ink2} px={iconSize.inline} /> : null}
      {label ? (
        <Txt v="small" color={colors.ink2}>
          {label}
        </Txt>
      ) : null}
      <Txt v="small" medium numberOfLines={1}>
        {value}
      </Txt>
      <Icon as={ChevronDown} size="inline" color={colors.ink2} />
    </Pressable>
  )
}

/** 勾选胶囊（家当、常记）：左边一个方框，勾上后方框填墨色、整颗淡墨底。label 用名词；读屏念 a11yLabel（说全是做什么） */
export function CheckChip({
  label,
  a11yLabel,
  checked,
  onChange,
}: {
  label: string
  a11yLabel?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const box = iconSize.inline
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={a11yLabel ?? label}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        {
          height: size.chip,
          paddingHorizontal: space.sm,
          borderRadius: radius.pill,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          backgroundColor: checked ? tint(colors.active, 0.08) : colors.fill,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={{
          width: box,
          height: box,
          borderRadius: radius.xs,
          borderWidth: 1.5,
          borderColor: checked ? colors.active : colors.ink2,
          backgroundColor: checked ? colors.active : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Check size={box - 4} color={colors.white} strokeWidth={3} /> : null}
      </View>
      <Txt v="small" color={colors.ink}>
        {label}
      </Txt>
    </Pressable>
  )
}

/** 分段选择：弱填充轨道里，白底浮起的胶囊滑到选中项（弹簧动画） */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const [w, setW] = useState(0)
  const reduce = useReducedMotion()
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  const pad = space.xxs / 2
  const seg = w > 0 ? (w - pad * 2) / options.length : 0
  const x = useSharedValue(idx * seg)
  useEffect(() => {
    x.value = reduce || seg === 0 ? idx * seg : withSpring(idx * seg, SPRING)
  }, [idx, seg, reduce, x])
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', backgroundColor: colors.fill, borderRadius: radius.pill, padding: pad }}
    >
      {seg > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: pad, top: pad, width: seg, height: size.chip, borderRadius: radius.pill, backgroundColor: colors.surface }, shadow, pill]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, height: size.chip, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt v="small" color={on ? colors.ink : colors.ink2} medium={on}>
              {o.label}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * 字签：一排小字选项，没有底色、没有胶囊；选中的墨色加粗、下面一粒墨点，其余淡墨。
 * 用在顶栏这种放不下分段控件、又不想再加一条灰底的地方（盘账右上角的 周 · 月 · 年）
 */
export function TextTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space.sm }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            hitSlop={{ top: space.xs, bottom: space.xs, left: space.xxs, right: space.xxs }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [{ alignItems: 'center', gap: space.xxs / 2 }, pressed && { opacity: 0.6 }]}
          >
            <Txt v="body" color={on ? colors.active : colors.ink2} medium={on}>
              {o.label}
            </Txt>
            <View style={{ width: space.xxs, height: space.xxs, borderRadius: radius.pill, backgroundColor: on ? colors.active : 'transparent' }} />
          </Pressable>
        )
      })}
    </View>
  )
}
