import { View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { colors, invite, radius, size, space } from '../theme'
import type { BookColor } from '../utils/ledgerCover'
import { BookCover } from './BookCover'
import { Txt } from './Txt'

/** 请帖的宽高比（竖版） */
export const INVITE_RATIO = 1.42

/** 四角的回纹（金线） */
function Corner({ x, y, flipX, flipY }: { x: number; y: number; flipX?: boolean; flipY?: boolean }) {
  const sx = flipX ? -1 : 1
  const sy = flipY ? -1 : 1
  const d = `M${x} ${y + 18 * sy} V${y} H${x + 18 * sx} M${x + 5 * sx} ${y + 13 * sy} V${y + 5 * sy} H${x + 13 * sx} V${y + 10 * sy} H${x + 9 * sx}`
  return <Path d={d} fill="none" stroke={invite.gold} strokeWidth={1.4} strokeLinecap="square" />
}

/**
 * 请帖：朱红洒金纸、双金线框、四角回纹，“请帖”二字 + 账本封面 + 谁邀请谁 + 邀请码（+ 二维码）。
 * 邀请页把它截成图片发到微信；加入页用它展示收到的邀请（不带二维码）。
 */
export function InviteCard({
  width,
  ledgerName,
  cover,
  inviter,
  profile,
  code,
  qrValue,
  expires,
}: {
  width: number
  ledgerName: string
  cover: BookColor
  inviter: string
  /** 指定给某个家人档案（“妈妈”），加入后认领 */
  profile?: string | null
  code: string
  qrValue?: string
  expires?: string // 'M月D日'
}) {
  const height = width * INVITE_RATIO
  const pad = 12
  const qr = Math.round(width * 0.36)
  return (
    <View style={{ width, height, borderRadius: radius.md, overflow: 'hidden' }}>
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="invitePaper" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={invite.red} />
            <Stop offset="1" stopColor={invite.redDeep} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#invitePaper)" />
        {/* 洒金：几颗散落的金点 */}
        {[
          [0.18, 0.12, 1.4],
          [0.82, 0.2, 1.1],
          [0.3, 0.86, 1.2],
          [0.7, 0.78, 1.5],
          [0.9, 0.55, 1],
          [0.08, 0.5, 1.1],
        ].map(([fx, fy, r], i) => (
          <Rect key={i} x={width * fx!} y={height * fy!} width={r! * 2} height={r! * 2} rx={r} fill={invite.gold} opacity={0.55} />
        ))}
        <Rect x={pad} y={pad} width={width - pad * 2} height={height - pad * 2} fill="none" stroke={invite.gold} strokeWidth={1.4} />
        <Rect x={pad + 5} y={pad + 5} width={width - pad * 2 - 10} height={height - pad * 2 - 10} fill="none" stroke={invite.gold} strokeOpacity={0.6} strokeWidth={0.8} />
        <Corner x={pad + 9} y={pad + 9} />
        <Corner x={width - pad - 9} y={pad + 9} flipX />
        <Corner x={pad + 9} y={height - pad - 9} flipY />
        <Corner x={width - pad - 9} y={height - pad - 9} flipX flipY />
      </Svg>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.xl + space.xs, paddingHorizontal: space.xl }}>
        <View style={{ alignItems: 'center', gap: space.xs }}>
          <Txt serif allowFontScaling={false} color={invite.goldLight} style={{ fontSize: 30, lineHeight: 38, letterSpacing: 14, marginLeft: 14 }}>
            请帖
          </Txt>
          <BookCover color={cover} width={size.bookInvite} />
        </View>

        <View style={{ alignItems: 'center', gap: space.xxs }}>
          <Txt v="small" color={invite.goldLight} center allowFontScaling={false}>
            {inviter} 诚邀{profile ? `「${profile}」` : '您'}
          </Txt>
          <Txt serif allowFontScaling={false} color={invite.goldLight} center numberOfLines={1} style={{ fontSize: 24, lineHeight: 32 }}>
            共入「{ledgerName}」
          </Txt>
          <Txt v="small" color={invite.goldLight} center allowFontScaling={false} style={{ opacity: 0.85 }}>
            一本家账，大家同记
          </Txt>
        </View>

        {qrValue ? (
          <View style={{ padding: space.xs, backgroundColor: invite.paper, borderRadius: radius.sm }}>
            <QRCode value={qrValue} size={qr} color={colors.ink} backgroundColor={invite.paper} />
          </View>
        ) : null}

        <View style={{ alignItems: 'center', gap: space.xxs }}>
          <Txt serif allowFontScaling={false} color={invite.goldLight} style={{ fontSize: 26, lineHeight: 34, letterSpacing: 6, marginLeft: 6 }}>
            {code}
          </Txt>
          <Txt v="caption" color={invite.goldLight} center allowFontScaling={false} style={{ opacity: 0.8 }}>
            {qrValue ? '扫码，或在「账房」里输入邀请码' : '邀请码'}
            {expires ? ` · ${expires}前有效` : ''}
          </Txt>
        </View>
      </View>
    </View>
  )
}
