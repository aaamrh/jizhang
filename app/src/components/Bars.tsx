import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { amountColor, colors, expenseColor, necessityColors, overColor, radius, size, space, tierColors } from '../theme'
import type { BudgetLine } from '../types/domain'
import { NECESSITIES, NECESSITY_LABEL, type Necessity } from '../utils/necessity'
import { formatPlain, formatYuan } from '../utils/money'
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

/** 支出按必要性的占比条 + 图例；点色条或图例（可选）看这一类 */
export function NecessityBar({ parts, onPick }: { parts: Record<Necessity, number>; onPick?: (n: Necessity) => void }) {
  const total = NECESSITIES.reduce((a, k) => a + parts[k], 0)
  if (total <= 0) return <Txt muted v="small">还没有支出</Txt>
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
              hitSlop={{ top: space.sm, bottom: space.sm }}
              onPress={() => onPick?.(k)}
              style={{ flex: parts[k], backgroundColor: necessityColors[k] }}
            />
          ) : null,
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
        {NECESSITIES.map((k) => (
          <Pressable key={k} disabled={!onPick} accessibilityRole={onPick ? 'button' : undefined} hitSlop={space.xs} onPress={() => onPick?.(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
            <View style={{ width: space.xs, height: space.xs, borderRadius: radius.pill, backgroundColor: necessityColors[k] }} />
            <Txt v="caption" muted>
              {NECESSITY_LABEL[k]} {Math.round((parts[k] / total) * 100)}%
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
            {total > 0 ? `${Math.round((cents / total) * 100)}%` : ''}
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
