import { Button } from '../../components/Button'
import { Plus } from '../../components/icons/ui'
import { ListRow } from '../../components/ListRow'
import { Stat } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { useWallets } from '../../hooks/data'
import { amountColor, colors } from '../../theme'
import { WALLET_KIND_GLYPH, WALLET_KIND_LABEL, type WalletWithBalance } from '../../types/domain'
import type { StackProps } from '../../types/navigation'
import { formatYuan } from '../../utils/money'

/** 负债类显示“欠款”，余额为负时显示正数 */
export const walletAmount = (w: WalletWithBalance) =>
  w.liability ? (w.balanceCents <= 0 ? `欠 ${formatYuan(-w.balanceCents)}` : `余 ${formatYuan(w.balanceCents)}`) : formatYuan(w.balanceCents)

export default function WalletsPage({ navigation }: StackProps<'Wallets'>) {
  const all = useWallets(true, undefined, true)
  const active = all.filter((w) => !w.archived && w.kind !== 'jar')
  const jars = all.filter((w) => w.kind === 'jar' && !w.archived)
  const archived = all.filter((w) => w.archived)
  const assets = active.filter((w) => !w.liability)
  const debts = active.filter((w) => w.liability)
  const total = active.reduce((n, w) => n + w.balanceCents, 0) + jars.reduce((n, w) => n + w.balanceCents, 0)

  const list = (ws: WalletWithBalance[]) =>
    ws.map((w) => (
      <ListRow
        key={w.id}
        glyph={WALLET_KIND_GLYPH[w.kind]}
        iconColor={w.liability ? colors.seal : undefined}
        title={w.name}
        subtitle={WALLET_KIND_LABEL[w.kind]}
        value={
          <Txt serif color={amountColor(w.balanceCents)}>
            {walletAmount(w)}
          </Txt>
        }
        // 储钱罐属于攒钱目标，在心愿里存取
        onPress={() => (w.kind === 'jar' ? navigation.navigate('Achievements') : navigation.navigate('WalletForm', { id: w.id }))}
      />
    ))

  return (
    <Screen footer={<Button title="添加钱袋" icon={Plus} variant="primary" onPress={() => navigation.navigate('WalletForm', {})} />}>
      <Section>
        <Stat label="净资产（资产 − 欠款）" value={formatYuan(total)} v="amount" align="left" color={amountColor(total)} />
      </Section>
      <Section list title="资产">
        {assets.length ? list(assets) : <ListRow title="暂无" chevron={false} />}
      </Section>
      {debts.length ? (
        <Section list title="负债">
          {list(debts)}
        </Section>
      ) : null}
      {jars.length ? (
        <Section list title="储钱罐（攒钱目标）">
          {list(jars)}
        </Section>
      ) : null}
      {archived.length ? (
        <Section list title="已归档">
          {list(archived)}
        </Section>
      ) : null}
      <Button title="校准余额" variant="ghost" onPress={() => navigation.navigate('Calibrate', {})} />
    </Screen>
  )
}
