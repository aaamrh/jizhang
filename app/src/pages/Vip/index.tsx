import { useEffect, useRef, useState } from 'react'
import { Modal, useWindowDimensions, View } from 'react-native'
import { Button } from '../../components/Button'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { VipCard, VipUnlock } from '../../components/Vip'
import { buyVip, loadProducts } from '../../hooks/account'
import { useAuth } from '../../store/authStore'
import { colors, GUTTER, space } from '../../theme'
import type { Product } from '../../types/api'
import type { StackProps } from '../../types/navigation'
import { dayLabel } from '../../utils/dates'
import { formatYuan } from '../../utils/money'
import { VIP_NAME } from '../../utils/copy'
import { VIP_PERKS } from '../../utils/vipPerks'

function statusText(vipUntil: string | null, isVip: boolean) {
  if (!vipUntil) return `还不是${VIP_NAME}`
  const day = dayLabel(vipUntil.slice(0, 10))
  return isVip ? `${VIP_NAME}有效期至 ${day}` : `${VIP_NAME}已于 ${day} 到期：家人新记的账暂停汇进家庭账本，续费后恢复，这段时间的账也会补上`
}

export default function VipPage({ navigation, route }: StackProps<'Vip'>) {
  const user = useAuth((s) => s.user)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [unlock, setUnlock] = useState(false)
  const { width } = useWindowDimensions()
  // 从“不是”变成“是”的那一刻，放一次腰牌落下的动画
  const wasVip = useRef(!!user?.isVip)
  useEffect(() => {
    if (user?.isVip && !wasVip.current) setUnlock(true)
    wasVip.current = !!user?.isVip
  }, [user?.isVip])

  useEffect(() => {
    loadProducts()
      .then(setProducts)
      .catch((e) => setError(e?.message ?? '加载失败'))
  }, [user?.id]) // 登录后重新取：新用户有新人价

  const buy = async (p: Product) => {
    if (!user) return navigation.navigate('Login')
    setBusy(p.id)
    await buyVip(p.id)
    setBusy(null)
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xs }}>
        <VipCard width={width - GUTTER * 2} until={user?.vipUntil ?? null} active={!!user?.isVip} />
        <Txt v="small" muted center>
          {user ? statusText(user.vipUntil, user.isVip) : '登录后开通'}
        </Txt>
      </View>
      {route.params?.reason ? (
        <Txt v="small" color={colors.seal} center>
          {route.params.reason}
        </Txt>
      ) : null}

      <Section list title={`${VIP_NAME}权益`}>
        {VIP_PERKS.map((p) => (
          <ListRow key={p.key} glyph={p.glyph} iconColor={colors.gold} title={p.title} subtitle={p.line} chevron={false} />
        ))}
      </Section>
      <Txt v="caption" muted>
        以后新增的权益，已开通的{VIP_NAME}自动享有。记账、常记、家当、细算、预算这些功能永远免费，没有广告。
      </Txt>

      {error ? <Txt v="small" muted>{error}</Txt> : null}
      {products?.length ? (
        <Section list title="开通方案">
          {products.map((p) => (
            <ListRow
              key={p.id}
              title={`${p.name}${p.badge ? ` · ${p.badge}` : ''}`}
              subtitle={`${p.days >= 365 ? `${Math.round(p.days / 365)} 年` : `${p.days} 天`}${p.originalPriceCents > p.priceCents ? `　原价 ${formatYuan(p.originalPriceCents)}` : ''}`}
              chevron={false}
              value={<Button title={formatYuan(p.priceCents)} variant="primary" size="sm" disabled={busy !== null} onPress={() => buy(p)} />}
            />
          ))}
        </Section>
      ) : null}
      <Modal transparent visible={unlock} animationType="fade" statusBarTranslucent onRequestClose={() => setUnlock(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(20,10,20,0.72)', alignItems: 'center', justifyContent: 'center', padding: GUTTER }}>
          {unlock ? <VipUnlock width={width - GUTTER * 2} onDone={() => setUnlock(false)} /> : null}
        </View>
      </Modal>
      <Txt v="caption" faint center>
        续费在原到期日上累加。{VIP_NAME}跟账号走，换手机、换系统都能用。
      </Txt>
    </Screen>
  )
}
