import { Image, View } from 'react-native'
import { colors, iconSize, radius, shadow, space, tint } from '../theme'
import type { Asset } from '../types/domain'
import { assetCost } from '../utils/assetCost'
import { today } from '../utils/dates'
import { formatYuan } from '../utils/money'
import { usePhoto } from '../hooks/photo'
import { PressScale } from './motion'
import { RetroGlyph } from './RetroGlyph'
import { Txt } from './Txt'

const ENDED = { sold: '已卖出', lost: '已丢失', broken: '已损坏' } as const

/** 家当封面：有照片显示照片，没有就是淡金底上的箱笼图标 */
export function AssetCover({ a, rounded = 'top' }: { a: Pick<Asset, 'id' | 'photo' | 'photoFileId' | 'photoCachedFor'>; rounded?: 'top' | 'all' }) {
  const r = rounded === 'all' ? { borderRadius: radius.md } : { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md }
  const { uri } = usePhoto('assets', a.id, a)
  return uri ? (
    <Image source={{ uri }} resizeMode="cover" style={[{ width: '100%', aspectRatio: 4 / 3 }, r]} accessibilityIgnoresInvertColors />
  ) : (
    <View style={[{ width: '100%', aspectRatio: 4 / 3, backgroundColor: tint(colors.gold, 0.1), alignItems: 'center', justifyContent: 'center' }, r]}>
      <RetroGlyph name="tab-chest" color={colors.gold} px={iconSize.glyphLg * 1.5} />
    </View>
  )
}

/** 家当宫格卡片：封面、名称、按天或按次的成本、持有天数 */
export function AssetCard({ a, onPress }: { a: Asset; onPress: () => void }) {
  const c = assetCost(a, today())
  const byUse = a.costMode === 'use'
  const main = byUse ? (c.perUseCents === null ? '还没记次数' : `${formatYuan(c.perUseCents)}/次`) : `${formatYuan(c.perDayCents)}/天`
  const holding = a.status === 'holding'
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${a.name}，${main}`}
      onPress={onPress}
      style={[{ backgroundColor: colors.surface, borderRadius: radius.md }, shadow]}
    >
      <AssetCover a={a} />
      <View style={{ padding: space.sm, gap: space.xxs }}>
        <Txt medium numberOfLines={1}>
          {a.name}
        </Txt>
        <Txt v="h2" serif numberOfLines={1} color={byUse && c.perUseCents === null ? colors.ink3 : colors.ink}>
          {main}
        </Txt>
        <Txt v="caption" muted numberOfLines={1}>
          {holding ? `已用 ${c.days} 天` : `${ENDED[a.status as keyof typeof ENDED]} · 用了 ${c.days} 天`}
          {byUse ? ` · ${a.useCount} 次` : ''}
        </Txt>
      </View>
    </PressScale>
  )
}
