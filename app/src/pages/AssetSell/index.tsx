import { useState } from 'react'
import { Button } from '../../components/Button'
import { DateField } from '../../components/DateField'
import { attempt, showAlert } from '../../components/dialogs'
import { Picker } from '../../components/Picker'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { assetActions } from '../../hooks/actions'
import { useAsset, useWallets } from '../../hooks/data'
import { colors, incomeColor } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { assetCost } from '../../utils/assetCost'
import { dayLabel, today } from '../../utils/dates'
import { formatYuan, parseYuan } from '../../utils/money'

export default function AssetSellPage({ navigation, route }: StackProps<'AssetSell'>) {
  const a = useAsset(route.params.id)
  const wallets = useWallets()
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(today())
  const [walletId, setWalletId] = useState<string | null>(wallets[0]?.id ?? null)
  if (!a)
    return (
      <Screen>
        <Txt muted>这件家当已经不存在了</Txt>
      </Screen>
    )

  const cents = parseYuan(price)
  const preview = cents === null ? null : assetCost({ ...a, soldCents: cents, endedOn: date }, today())

  const sell = () => {
    if (cents === null) return showAlert('提示', '请输入正确的卖价，送人可以填 0')
    if (attempt(() => assetActions.sell(a.id, { priceCents: cents, date, walletId: walletId ?? '' }))) navigation.goBack()
  }

  return (
    <Screen footer={<Button title="确认卖出" variant="primary" onPress={sell} />}>
      <Txt v="small" muted>
        {a.name} · 买价 {formatYuan(a.costCents)}
      </Txt>
      <TextField label="卖了多少钱" display prefix="¥" value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
      <Section list>
        <DateField label="卖出日期" value={date} onChange={setDate} display={dayLabel} />
        <Picker label="钱进哪个钱袋" value={walletId} options={wallets.map((w) => ({ value: w.id, label: w.name }))} onChange={setWalletId} />
      </Section>
      {preview ? (
        <Section>
          <Txt color={preview.profitCents! >= 0 ? incomeColor : colors.ink}>
            {preview.profitCents! >= 0 ? `赚了 ${formatYuan(preview.profitCents!)}` : `前后实际花了 ${formatYuan(preview.netCents)}`}
          </Txt>
          <Txt v="small" muted>
            用了 {preview.days} 天，折合每天 {formatYuan(preview.perDayCents)}。会自动记一笔「变卖」收入。
          </Txt>
        </Section>
      ) : null}
    </Screen>
  )
}
