import { useState } from 'react'
import { Button } from '../../components/Button'
import { attempt, showAlert } from '../../components/dialogs'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { walletActions } from '../../hooks/actions'
import { useWallets } from '../../hooks/data'
import type { StackProps } from '../../types/navigation'
import { centsToInput, parseYuan } from '../../utils/money'

/** 校准余额：逐个钱袋填“现在实际有多少 / 欠多少”，自动反推初始余额，不产生账目 */
export default function CalibratePage({ navigation, route }: StackProps<'Calibrate'>) {
  const wallets = useWallets(false, route.params?.ledgerId)
  // 负债类填的是欠款（正数），保存时取负
  const shown = (w: (typeof wallets)[number]) => centsToInput(Math.abs(w.liability ? -w.balanceCents : w.balanceCents))
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(wallets.map((w) => [w.id, shown(w)])))

  const save = () => {
    const changes: [string, number][] = []
    for (const w of wallets) {
      const text = values[w.id] ?? ''
      if (text === shown(w)) continue
      const n = parseYuan(text === '' ? '0' : text)
      if (n === null) return showAlert('提示', `「${w.name}」的金额不正确`)
      changes.push([w.id, w.liability ? -n : n])
    }
    if (attempt(() => changes.forEach(([id, cents]) => walletActions.calibrate(id, cents)))) navigation.goBack()
  }

  return (
    <Screen footer={<Button title="保存" variant="primary" onPress={save} />}>
      <Txt v="small" muted>
        填每个钱袋现在实际的数。只调整起始余额，不会多记一笔账。
      </Txt>
      <Section>
        {wallets.map((w) => (
          <TextField
            key={w.id}
            label={w.liability ? `${w.name}：现在欠多少` : `${w.name}：现在有多少`}
            value={values[w.id] ?? ''}
            onChangeText={(v) => setValues({ ...values, [w.id]: v })}
            keyboardType="decimal-pad"
            prefix="¥"
            placeholder="0"
          />
        ))}
      </Section>
      <Button title="管理钱袋（添加信用卡、花呗等）" variant="ghost" onPress={() => navigation.navigate('Wallets')} />
    </Screen>
  )
}
