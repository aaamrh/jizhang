import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Button } from '../../components/Button'
import { CategoryGrid } from '../../components/CategoryGrid'
import { CategoryIcon } from '../../components/CategoryIcon'
import { attempt, showAlert } from '../../components/dialogs'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { ENTRY_STAMP } from '../../utils/seal'
import { Seal } from '../../components/Seal'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { budgetAlertAfterSave, txnActions } from '../../hooks/actions'
import { useCategories, useWallets } from '../../hooks/data'
import { useUi } from '../../store/uiStore'
import { size, space } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { today } from '../../utils/dates'
import { formatYuan, parseYuan } from '../../utils/money'

/** 长辈模式记一笔：选分类 → 输金额 → 完成。日期今天、第一个钱袋、自己花的 */
export default function ElderEntryPage({ navigation }: StackProps<'ElderEntry'>) {
  const cats = useCategories('expense')
  const wallets = useWallets()
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const cat = cats.find((c) => c.id === categoryId)

  const done = () => {
    const cents = parseYuan(amount)
    if (cents === null || cents <= 0) return showAlert('提示', '请输入花了多少钱')
    const date = today()
    const ok = attempt(() =>
      txnActions.create({ type: 'expense', amountCents: cents, categoryId, walletId: wallets[0]?.id ?? '', toWalletId: null, date, note: '', asset: null }),
    )
    if (!ok) return
    const msg = budgetAlertAfterSave(categoryId, date)
    if (msg) useUi.getState().showToast(msg)
    setSaved(cents)
  }

  const again = () => {
    setCategoryId(null)
    setAmount('')
    setSaved(null)
  }

  if (saved !== null) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
          <Seal char={ENTRY_STAMP} px={size.sealLg} filled />
          <Txt v="title">记好了</Txt>
          <Txt>
            {cat?.name}　{formatYuan(saved)}
          </Txt>
        </View>
        <Button title="再记一笔" onPress={again} />
        <Button title="好了" variant="primary" onPress={() => navigation.goBack()} />
      </Screen>
    )
  }

  if (!cat) {
    return (
      <Screen>
        <Txt v="title">买了什么？</Txt>
        <CategoryGrid big items={cats} value={null} onChange={setCategoryId} />
      </Screen>
    )
  }

  return (
    <Screen footer={<Button title="完成" variant="primary" onPress={done} />}>
      <Section>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="换一个分类"
          onPress={() => setCategoryId(null)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
        >
          <CategoryIcon icon={cat.icon} color={cat.color} variant="lg" />
          <Txt v="h2" style={{ flex: 1 }}>
            {cat.name}
          </Txt>
          <Txt muted>换一个</Txt>
        </Pressable>
      </Section>
      <TextField label="花了多少钱？" display prefix="¥" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="decimal-pad" autoFocus accessibilityLabel="金额" />
    </Screen>
  )
}
