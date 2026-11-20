import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, useWindowDimensions, View, type ScrollViewInstance } from 'react-native'
import { buyVip, loadProducts } from '../hooks/account'
import { navigationRef } from '../navigation/ref'
import { useAuth } from '../store/authStore'
import { useUi } from '../store/uiStore'
import { colors, expenseColor, GUTTER, hairline, radius, size, space, tint, vip } from '../theme'
import type { Product } from '../types/api'
import { VIP_NAME } from '../utils/copy'
import { formatYuan } from '../utils/money'
import { VIP_PERKS, type PerkKey } from '../utils/vipPerks'
import { BookCover } from './BookCover'
import { Button } from './Button'
import { MemberAvatar } from './MemberAvatar'
import { Plaque } from './Plaque'
import { Sheet } from './Sheet'
import { Txt } from './Txt'

/**
 * 开通提醒抽屉（参照鲨鱼记账）：不是大掌柜的人点了会员功能，从底部弹出。
 * 上面一排 tab，一个权益一个，点了哪个功能就停在哪一项；每项一张卡片（名字、一句话、示意图），可以左右滑。
 * 下面选套餐、开通。不做假倒计时、不写虚构的原价（只有后台真的设了活动价才划掉原价）。
 */
export function VipSheet() {
  const perk = useUi((s) => s.vipSheet)
  const hide = useUi((s) => s.hideVipSheet)
  const user = useAuth((s) => s.user)
  const { width } = useWindowDimensions()
  const pageW = width - GUTTER * 2
  const [idx, setIdx] = useState(0)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pager = useRef<ScrollViewInstance>(null)

  useEffect(() => {
    if (!perk) return
    const i = Math.max(0, VIP_PERKS.findIndex((p) => p.key === perk))
    setIdx(i)
    requestAnimationFrame(() => pager.current?.scrollTo({ x: i * pageW, animated: false }))
    loadProducts()
      .then((ps) => {
        const shown = ps.slice(0, 3)
        setProducts(shown)
        // 默认选年卡（最常买），没有就选第一个
        setPick((cur) => (cur && shown.some((p) => p.id === cur) ? cur : (shown.find((p) => p.days >= 365 && p.days < 730) ?? shown[0])?.id ?? null))
      })
      .catch(() => setProducts([]))
  }, [perk, pageW])

  const go = (i: number) => {
    setIdx(i)
    pager.current?.scrollTo({ x: i * pageW, animated: true })
  }
  const chosen = products?.find((p) => p.id === pick)
  const buy = async () => {
    if (!user) {
      hide()
      if (navigationRef.isReady()) navigationRef.navigate('Login')
      return
    }
    if (!chosen || busy) return
    setBusy(true)
    const ok = await buyVip(chosen.id)
    setBusy(false)
    if (ok && useAuth.getState().user?.isVip) {
      hide()
      useUi.getState().showToast(`已开通${VIP_NAME}`)
    }
  }

  return (
    <Sheet visible={!!perk} onClose={hide} title={`${VIP_NAME}权益`} scroll={false}>
      <View style={{ gap: space.md, paddingBottom: space.sm }}>
        {/* 一排 tab：一个权益一个 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, gap: space.lg }}>
          {VIP_PERKS.map((p, i) => (
            <Pressable key={p.key} accessibilityRole="tab" accessibilityState={{ selected: i === idx }} onPress={() => go(i)} style={{ alignItems: 'center', gap: space.xxs }}>
              <Txt v="h2" color={i === idx ? colors.ink : colors.ink3}>
                {p.title}
              </Txt>
              <View style={{ width: space.lg, height: size.bar / 2, borderRadius: radius.pill, backgroundColor: i === idx ? colors.active : 'transparent' }} />
            </Pressable>
          ))}
        </ScrollView>

        {/* 一项一张卡片，可以左右滑 */}
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: GUTTER }}
          onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / pageW))}
        >
          {VIP_PERKS.map((p) => (
            <View key={p.key} style={{ width: pageW }}>
              <View style={{ marginHorizontal: space.xxs, borderRadius: radius.md, backgroundColor: colors.fill, padding: space.lg, gap: space.xs }}>
                <Txt v="title">{p.title}</Txt>
                <Txt v="small" muted>
                  {p.line}
                </Txt>
                <View style={{ height: size.perkArt, alignItems: 'center', justifyContent: 'center' }}>
                  <PerkArt k={p.key} w={pageW - space.lg * 2 - space.xxs * 2} />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
        <Txt v="caption" faint center>
          {idx + 1} / {VIP_PERKS.length}
        </Txt>

        {/* 套餐：默认年卡；后台真的设了活动价才划掉原价 */}
        {products?.length ? (
          <View style={{ flexDirection: 'row', gap: space.xs, paddingHorizontal: GUTTER }}>
            {products.map((p) => {
              const on = p.id === pick
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${p.name} ${formatYuan(p.priceCents)}`}
                  onPress={() => setPick(p.id)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: space.xxs,
                    paddingVertical: space.sm,
                    borderRadius: radius.md,
                    borderWidth: on ? hairline * 4 : hairline * 2,
                    borderColor: on ? vip.gold : colors.hair,
                    backgroundColor: on ? tint(vip.gold, 0.1) : colors.surface,
                  }}
                >
                  {p.badge ? (
                    <Txt v="caption" color={vip.purple}>
                      {p.badge}
                    </Txt>
                  ) : null}
                  <Txt v="small">{p.name}</Txt>
                  <Txt v="title" color={on ? vip.purple : colors.ink}>
                    {formatYuan(p.priceCents)}
                  </Txt>
                  <Txt v="caption" faint style={p.originalPriceCents > p.priceCents ? { textDecorationLine: 'line-through' } : undefined}>
                    {p.originalPriceCents > p.priceCents ? formatYuan(p.originalPriceCents) : p.days >= 365 ? `约 ${formatYuan(Math.round(p.priceCents / (p.days / 30)))}/月` : `${p.days} 天`}
                  </Txt>
                </Pressable>
              )
            })}
          </View>
        ) : products ? (
          <Txt v="small" muted center>
            暂时取不到价格，稍后再试
          </Txt>
        ) : null}

        <View style={{ paddingHorizontal: GUTTER, gap: space.xs }}>
          <Button
            title={user ? `开通${VIP_NAME}${chosen ? ` ${formatYuan(chosen.priceCents)}` : ''}` : `登录后开通${VIP_NAME}`}
            variant="primary"
            disabled={busy || (!!user && !chosen)}
            onPress={buy}
          />
          <Txt
            v="caption"
            faint
            center
            onPress={() => {
              hide()
              if (navigationRef.isReady()) navigationRef.navigate('Legal', { kind: 'terms' })
            }}
          >
            开通即表示同意《用户协议》中的会员条款 · 记账、预算、复盘这些永远免费
          </Txt>
        </View>
      </View>
    </Sheet>
  )
}

/** 每项权益的示意图：用 App 自己的样子画，不放截图 */
function PerkArt({ k, w }: { k: PerkKey; w: number }) {
  if (k === 'family') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <BookCover color="songlv" title="我们家" width={size.bookHero} />
        <View style={{ gap: space.xs }}>
          {[
            ['我', '记了 1,260'],
            ['妈妈', '记了 860'],
            ['爸爸', '记了 420'],
          ].map(([n, sub]) => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <MemberAvatar name={n!} px={size.circle - space.sm} />
              <Txt v="small" muted>
                {sub}
              </Txt>
            </View>
          ))}
        </View>
      </View>
    )
  }
  if (k === 'wishes') {
    return <Plaque tier="gold" stage="fulfilled" name="看海" amount="¥5,000" duration="三月成" date="2026.08.01" width={Math.min(w, size.perkArt * 1.6 - space.md)} />
  }
  if (k === 'calendar') {
    // 一个月的小日历：有账的日子下面一行小红字
    const spent: Record<number, string> = { 2: '36', 3: '128', 5: '12', 8: '560', 9: '24', 11: '88', 12: '46' }
    const cell = Math.floor(Math.min(w, size.perkArt * 1.6) / 7)
    return (
      <View style={{ width: cell * 7 }}>
        <View style={{ flexDirection: 'row' }}>
          {'一二三四五六日'.split('').map((d) => (
            <Txt key={d} v="caption" faint center style={{ width: cell }}>
              {d}
            </Txt>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 14 }, (_, i) => i + 1).map((d) => (
            <View key={d} style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: d === 12 ? colors.active : 'transparent' }}>
              <Txt v="small" color={d === 12 ? colors.white : colors.ink}>
                {d}
              </Txt>
              <Txt v="caption" color={d === 12 ? colors.white : expenseColor} style={{ opacity: spent[d] ? 1 : 0 }}>
                {spent[d] ?? '0'}
              </Txt>
            </View>
          ))}
        </View>
      </View>
    )
  }
  // 导出 Excel：一张小表
  const rows = [
    ['日期', '分类', '金额'],
    ['11-18', '买菜', '-36'],
    ['11-18', '外出就餐', '-128'],
    ['11-17', '工资', '8,000'],
  ]
  const col = Math.floor(Math.min(w, size.perkArt * 1.8) / 3)
  return (
    <View style={{ borderWidth: hairline * 2, borderColor: colors.hair, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', backgroundColor: i === 0 ? tint(colors.ink, 0.06) : undefined, borderTopWidth: i ? hairline : 0, borderColor: colors.hair }}>
          {r.map((c, j) => (
            <Txt key={j} v="small" medium={i === 0} color={i > 0 && j === 2 ? (c.startsWith('-') ? expenseColor : colors.ink) : colors.ink} style={{ width: col, paddingVertical: space.xxs, paddingHorizontal: space.xs, textAlign: j === 2 ? 'right' : 'left' }}>
              {c}
            </Txt>
          ))}
        </View>
      ))}
      <Txt v="caption" faint center style={{ paddingVertical: space.xxs }}>
        账房-我的账本.xlsx
      </Txt>
    </View>
  )
}
