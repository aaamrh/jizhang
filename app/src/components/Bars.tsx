import { useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { amountColor, colors, expenseColor, hairline, necessityColors, overColor, radius, size, space, tierColors, type } from '../theme'
import type { BudgetLine } from '../types/domain'
import { NECESSITIES, NECESSITY_LABEL, type Necessity } from '../utils/necessity'
import { formatPlain, formatShare, formatYuan } from '../utils/money'
import type { SpendBucket } from '../utils/periodStats'
import { Txt } from './Txt'

/** 细进度轨道 */
function Track({ ratio, color, thick }: { ratio: number; color: string; thick?: boolean }) {
  const h = thick ? size.barThick : size.bar
  return (
    <View style={{ height: h, borderRadius: radius.pill, backgroundColor: colors.fill, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, height: '100%', backgroundColor: color, borderRadius: radius.pill }} />
    </View>
  )
}

/** 支出按必要性的占比条 + 图例；点色条或图例（可选）看这一类。selected：正在只看的那一类，其余淡下去 */
export function NecessityBar({ parts, onPick, selected }: { parts: Record<Necessity, number>; onPick?: (n: Necessity) => void; selected?: Necessity | null }) {
  const total = NECESSITIES.reduce((a, k) => a + parts[k], 0)
  if (total <= 0) return <Txt muted v="small">还没有支出</Txt>
  const dim = (k: Necessity) => (selected && selected !== k ? 0.25 : 1)
  return (
    <View style={{ gap: space.sm }}>
      <View
        accessibilityLabel="支出必要性占比"
        style={{ flexDirection: 'row', height: size.barThick, borderRadius: radius.pill, overflow: 'hidden', gap: 2 }}
      >
        {NECESSITIES.map((k) =>
          parts[k] > 0 ? (
            <Pressable
              key={k}
              disabled={!onPick}
              accessibilityRole={onPick ? 'button' : undefined}
              accessibilityLabel={NECESSITY_LABEL[k]}
              accessibilityState={{ selected: selected === k }}
              hitSlop={{ top: space.sm, bottom: space.sm }}
              onPress={() => onPick?.(k)}
              style={{ flex: parts[k], backgroundColor: necessityColors[k], opacity: dim(k) }}
            />
          ) : null,
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
        {NECESSITIES.map((k) => (
          <Pressable
            key={k}
            disabled={!onPick || parts[k] <= 0}
            accessibilityRole={onPick ? 'button' : undefined}
            accessibilityState={{ selected: selected === k }}
            hitSlop={space.xs}
            onPress={() => onPick?.(k)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs, opacity: dim(k) }}
          >
            <View style={{ width: space.xs, height: space.xs, borderRadius: radius.pill, backgroundColor: necessityColors[k] }} />
            <Txt v="caption" muted={selected !== k} medium={selected === k}>
              {NECESSITY_LABEL[k]} {formatShare(parts[k], total)}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

/** 排行的一行：图标、名称、占比、金额，下面一条细线（分类色） */
export function RankRow({
  label,
  cents,
  max,
  total,
  color = colors.green,
  leading,
  onPress,
}: {
  label: string
  cents: number
  max: number
  total: number
  color?: string
  leading?: ReactNode
  /** 点开看这一项的明细 */
  onPress?: () => void
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, pressed && { opacity: 0.6 }]}
    >
      {leading}
      <View style={{ flex: 1, gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
          <Txt numberOfLines={1} style={{ flexShrink: 1 }}>
            {label}
          </Txt>
          <Txt v="caption" muted>
            {formatShare(cents, total)}
          </Txt>
          <View style={{ flex: 1 }} />
          <Txt serif color={expenseColor}>{formatPlain(cents)}</Txt>
        </View>
        <Track ratio={cents / Math.max(1, max)} color={color} />
      </View>
    </Pressable>
  )
}

/** 预算进度：超过 80% 变金色，超支变红 */
export function ProgressBar({ ratio }: { ratio: number }) {
  const color = ratio > 1 ? overColor : ratio >= 0.8 ? colors.gold : colors.green
  return (
    <View accessibilityLabel={`已用 ${Math.round(ratio * 100)}%`}>
      <Track ratio={ratio} color={color} />
    </View>
  )
}

/** 一条预算：已花 / 预算、进度条、还剩多少 */
export function BudgetLineRow({ line }: { line: BudgetLine }) {
  const over = line.leftCents < 0
  const rest = line.perDayCents !== null ? `，平均每天可花 ${formatYuan(line.perDayCents)}` : ''
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Txt>{line.name}</Txt>
        <Txt v="small" color={colors.ink2}>
          <Txt v="small" color={over ? overColor : colors.ink2}>
            {formatYuan(line.spentCents)}
          </Txt>
          {` / ${formatYuan(line.budgetCents)}`}
        </Txt>
      </View>
      <ProgressBar ratio={line.ratio} />
      {/* 字不变色，只有还剩 / 超出的金额带颜色 */}
      <Txt v="caption" color={colors.ink2}>
        {over ? '超出 ' : '还剩 '}
        <Txt v="caption" color={amountColor(line.leftCents)}>
          {formatYuan(Math.abs(line.leftCents))}
        </Txt>
        {over ? '' : rest}
      </Txt>
    </View>
  )
}

/** 按月柱状图（年账）：只画支出；点柱子看那个月的每一笔（可选） */
export function MonthBars({ months, onPick }: { months: { month: string; expenseCents: number }[]; onPick?: (month: string) => void }) {
  const max = Math.max(1, ...months.map((m) => m.expenseCents))
  return (
    <View accessibilityLabel="每月支出" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.xxs, height: size.chart }}>
      {months.map((m) => (
        <Pressable
          key={m.month}
          disabled={!onPick || m.expenseCents <= 0}
          accessibilityRole={onPick ? 'button' : undefined}
          accessibilityLabel={`${Number(m.month.slice(5))} 月`}
          onPress={() => onPick?.(m.month)}
          style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: space.xxs, height: '100%' }, pressed && { opacity: 0.6 }]}
        >
          <View style={{ flex: 1, width: '60%', justifyContent: 'flex-end' }}>
            <View
              style={{
                height: `${(Math.max(0, m.expenseCents) / max) * 100}%`,
                backgroundColor: tierColors.need,
                borderRadius: radius.sm / 2,
              }}
            />
          </View>
          <Txt v="caption" muted>
            {Number(m.month.slice(5))}
          </Txt>
        </Pressable>
      ))}
    </View>
  )
}

/** 柱间留白（规范：相邻的柱子之间 2） */
const BAR_GAP = 2
/** 横轴每个字的宽度（居中对着柱子） */
const AXIS_W = 20
/** 最高那根柱子上金额的宽度 */
const PEAK_W = 120

/**
 * 支出柱状图（盘账）：周、月每天一根，年每月一根。
 * 一个系列不要图例（标题说明是什么）；柱子细、顶端小圆角、立在底线上，柱间留 2；
 * 只在最高那根上写金额（不是每根都写）；虚线是上一段的日均（年是月均），右边写字说明，用来判断“这天花得多不多”；
 * 还没到的日子留位置不画，看得出这段过了多少；点柱子看那天（那个月）的每一笔，整列都能点
 */
export function SpendBars({
  bars,
  color,
  avgCents = 0,
  avgLabel,
  onPick,
}: {
  bars: SpendBucket[]
  color: string
  avgCents?: number
  avgLabel?: string
  onPick?: (b: SpendBucket) => void
}) {
  const [w, setW] = useState(0)
  const top = type.caption.lineHeight + space.xxs // 最高柱子上方留给金额
  const plot = size.chart - top
  const peakCents = Math.max(0, ...bars.map((b) => b.cents))
  const avg = Math.max(0, avgCents)
  const max = Math.max(1, peakCents, avg)
  const barH = (c: number) => (c > 0 ? Math.max(2, (c / max) * plot) : 0)
  const n = bars.length
  const bw = w > 0 ? (w - BAR_GAP * (n - 1)) / n : 0
  const center = (i: number) => i * (bw + BAR_GAP) + bw / 2
  const peak = peakCents > 0 ? bars.findIndex((b) => b.cents === peakCents) : -1
  const peakLeft = peak >= 0 ? Math.min(Math.max(0, center(peak) - PEAK_W / 2), w - PEAK_W) : 0
  const peakAlign = peakLeft <= 0 ? 'left' : peakLeft >= w - PEAK_W ? 'right' : 'center'
  const avgY = (avg / max) * plot
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ gap: space.xxs }}>
      <View style={{ height: size.chart }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: plot, flexDirection: 'row', alignItems: 'flex-end', gap: BAR_GAP }}>
          {bars.map((b) => (
            <Pressable
              key={b.key}
              disabled={!onPick || b.cents <= 0}
              accessibilityRole={onPick && b.cents > 0 ? 'button' : undefined}
              accessibilityLabel={b.future ? `${b.name}，还没到` : `${b.name}，花了 ${formatYuan(b.cents)}`}
              onPress={() => onPick?.(b)}
              style={({ pressed }) => [{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }, pressed && { opacity: 0.6 }]}
            >
              <View style={{ width: '100%', maxWidth: space.lg, height: barH(b.cents), backgroundColor: color, borderTopLeftRadius: radius.xs, borderTopRightRadius: radius.xs }} />
            </Pressable>
          ))}
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: hairline, backgroundColor: colors.hair }} />
        {w > 0 ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
            {avg > 0 && avgLabel ? (
              <>
                <Svg width={w} height={2} style={{ position: 'absolute', left: 0, bottom: avgY - 1 }}>
                  <Line x1={0} y1={1} x2={w} y2={1} stroke={colors.ink2} strokeWidth={1} strokeDasharray="4 3" />
                </Svg>
                <Txt v="caption" muted style={{ position: 'absolute', right: 0, bottom: avgY + space.xxs / 2, paddingLeft: space.xxs, backgroundColor: colors.surface }}>
                  {avgLabel}
                </Txt>
              </>
            ) : null}
            {peak >= 0 ? (
              <Txt v="caption" numberOfLines={1} style={{ position: 'absolute', width: PEAK_W, left: peakLeft, bottom: barH(peakCents) + space.xxs / 2, textAlign: peakAlign }}>
                {formatPlain(peakCents)}
              </Txt>
            ) : null}
          </View>
        ) : null}
      </View>
      {w > 0 ? (
        <View pointerEvents="none" style={{ height: type.caption.lineHeight }}>
          {bars.map((b, i) => {
            if (!b.axis) return null
            // 第一根、最后一根的字不出图表边：贴边时改成左对齐 / 右对齐
            const left = Math.min(Math.max(0, center(i) - AXIS_W / 2), w - AXIS_W)
            const align = center(i) < AXIS_W / 2 ? 'left' : center(i) > w - AXIS_W / 2 ? 'right' : 'center'
            return (
              <Txt key={b.key} v="caption" muted style={{ position: 'absolute', width: AXIS_W, left, textAlign: align }}>
                {b.axis}
              </Txt>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}
