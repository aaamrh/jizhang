import { Pressable, View } from 'react-native'
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg'
import { bookPaper, bookSlip, bookThread, colors, hairline, radius, shadow, size, space, tint } from '../theme'
import type { LedgerType } from '../types/domain'
import { BOOK_COLOR_NAME, BOOK_COLORS, ledgerCover, type BookColor } from '../utils/ledgerCover'
import { Txt } from './Txt'

const MAX_CHARS = 6

/**
 * 线装账簿封面：纸色封皮，左上角签条竖写账本名，右边装订线（四眼钉法：一道竖线，四个针眼各绕到书脊外）。
 * 宽度 ≥ 56 才写书名，列表里的小尺寸只画书的样子。
 */
export function BookCover({ color, title, width }: { color: BookColor; title?: string; width: number }) {
  const w = width
  const h = Math.round((w * 4) / 3)
  const r = Math.max(2, w * 0.06)
  const sw = Math.max(0.6, w / 90)
  const spine = w * 0.85
  const thread = w * 0.9
  const strip = { left: w * 0.12, top: h * 0.09, width: w * 0.22, height: h * 0.62 }
  const all = title && w >= 56 ? Array.from(title.trim()) : []
  const chars = all.length > MAX_CHARS ? [...all.slice(0, MAX_CHARS - 1), '⋮'] : all
  const pad = strip.width * 0.3
  const fs = Math.min(strip.width * 0.68, (strip.height - pad * 2) / (Math.max(chars.length, 3) * 1.12))
  return (
    <View
      style={[
        { width: w, height: h, backgroundColor: bookPaper[color], borderTopLeftRadius: r / 2, borderBottomLeftRadius: r / 2, borderTopRightRadius: r, borderBottomRightRadius: r },
        shadow,
      ]}
    >
      <Svg width={w} height={h} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="bookShade" x1="0" y1="0" x2="1" y2="0.3">
            <Stop offset="0" stopColor={colors.white} stopOpacity={0.08} />
            <Stop offset="1" stopColor={colors.ink} stopOpacity={0.08} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} rx={r} fill="url(#bookShade)" />
        <Line x1={spine} y1={0} x2={spine} y2={h} stroke={colors.ink} strokeOpacity={0.22} strokeWidth={sw} />
        <Line x1={thread} y1={0} x2={thread} y2={h} stroke={bookThread} strokeOpacity={0.85} strokeWidth={sw * 1.1} />
        {[0.1, 0.36, 0.64, 0.9].map((f) => (
          <Line key={f} x1={thread} y1={f * h} x2={w} y2={f * h} stroke={bookThread} strokeOpacity={0.85} strokeWidth={sw * 1.1} />
        ))}
      </Svg>
      <View style={{ position: 'absolute', ...strip, backgroundColor: bookSlip, borderWidth: hairline, borderColor: tint(colors.ink, 0.2), alignItems: 'center', paddingTop: pad }}>
        {chars.map((c, i) => (
          <Txt key={i} serif allowFontScaling={false} color={colors.ink} style={{ fontSize: fs, lineHeight: fs * 1.12 }}>
            {c}
          </Txt>
        ))}
      </View>
    </View>
  )
}

/** 选纸色：一排六本小书，选中的名字加深、下面一道墨线 */
export function BookColorPicker({ value, onChange }: { value: BookColor; onChange: (c: BookColor) => void }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {BOOK_COLORS.map((c) => {
        const on = c === value
        return (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`封面 ${BOOK_COLOR_NAME[c]}`}
            onPress={() => onChange(c)}
            style={{ flex: 1, alignItems: 'center', gap: space.xs, paddingTop: space.xxs }}
          >
            <BookCover color={c} width={size.bookSwatch} />
            <Txt v="caption" color={on ? colors.ink : colors.ink2} medium={on}>
              {BOOK_COLOR_NAME[c]}
            </Txt>
            <View style={{ width: space.md, height: size.bar / 2, borderRadius: radius.pill, backgroundColor: on ? colors.active : 'transparent' }} />
          </Pressable>
        )
      })}
    </View>
  )
}

/** 列表行左侧的小账簿（账本管理、切换账本抽屉），占和圆形图标一样的宽度，标题能对齐；不传 ledger 就是同宽的空位 */
export function LedgerCoverSlot({ ledger }: { ledger?: { type: LedgerType; cover: string | null } }) {
  return <View style={{ width: size.circle, alignItems: 'center' }}>{ledger ? <BookCover color={ledgerCover(ledger)} width={size.bookRow} /> : null}</View>
}
