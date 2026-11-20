import { useLayoutEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { CategoryGrid } from '../../components/CategoryGrid'
import { Segmented } from '../../components/Chip'
import { attempt, showAlert } from '../../components/dialogs'
import { Picker } from '../../components/Picker'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { deleteTemplateFlow, templateActions } from '../../hooks/actions'
import { useCategories, useCurrentLedger, useMembers, useWallets } from '../../hooks/data'
import type { StackProps } from '../../types/navigation'
import { centsToInput, parseYuan } from '../../utils/money'

const TYPES = [
  { value: 'expense' as const, label: '支出' },
  { value: 'income' as const, label: '收入' },
]

/** 新建 / 编辑常记；从一笔账“存为常记”时用那笔账预填 */
export default function TemplateFormPage({ navigation, route }: StackProps<'TemplateForm'>) {
  const id = route.params?.id
  const [init] = useState(() => (id ? templateActions.get(id) : route.params?.fromTxn ? templateActions.fromTxn(route.params.fromTxn) : undefined))
  const [type, setType] = useState<'expense' | 'income'>(init?.type ?? 'expense')
  const [name, setName] = useState(init?.name ?? '')
  const [amount, setAmount] = useState(init ? centsToInput(init.amountCents) : '')
  const [categoryId, setCategoryId] = useState<string | null>(init?.categoryId ?? null)
  const [walletId, setWalletId] = useState<string | null>(init?.walletId ?? null)
  const [note, setNote] = useState(init?.note ?? '')
  const [memberId, setMemberId] = useState<string | null>(init?.memberId ?? null)
  const cats = useCategories(type).filter((c) => !c.hidden)
  const wallets = useWallets()
  const family = useCurrentLedger()?.type === 'family'
  const members = useMembers().filter((m) => !m.removed)
  const wallet = walletId ?? wallets[0]?.id ?? null

  useLayoutEffect(() => navigation.setOptions({ title: id ? '常记' : '添加常记' }), [navigation, id])

  const save = () => {
    const cents = parseYuan(amount)
    if (cents === null || cents <= 0) return showAlert('提示', '请输入正确的金额')
    const cat = cats.find((c) => c.id === categoryId)
    const v = { type, name: name.trim() || cat?.name || '', amountCents: cents, categoryId: categoryId ?? '', walletId: wallet ?? '', note, memberId: family ? memberId : null }
    if (attempt(() => (id ? templateActions.update(id, v) : templateActions.create(v)))) navigation.goBack()
  }
  const remove = () => void deleteTemplateFlow({ id: id!, name: init?.name ?? name }).then((ok) => ok && navigation.goBack())

  return (
    <Screen footer={<Button title="保存" variant="primary" onPress={save} />}>
      <Segmented options={TYPES} value={type} onChange={(t) => (setType(t), setCategoryId(null))} />
      <Section plain>
        <TextField label="名称" value={name} onChangeText={setName} placeholder="比如：理发、上班交通" maxLength={12} />
        <TextField label="金额" value={amount} onChangeText={setAmount} placeholder="0.00" prefix="¥" keyboardType="decimal-pad" display />
      </Section>
      <Section title="分类" plain>
        <CategoryGrid items={cats} value={categoryId} onChange={setCategoryId} />
      </Section>
      <Section list>
        <Picker label="钱袋" value={wallet} options={wallets.map((w) => ({ value: w.id, label: w.name }))} onChange={setWalletId} />
        {family ? (
          <Picker
            label="谁花的"
            value={memberId ?? members.find((m) => m.isMe)?.id ?? null}
            options={members.map((m) => ({ value: m.id, label: m.isMe ? `${m.nickname}（我）` : m.nickname }))}
            onChange={(v) => setMemberId(members.find((m) => m.id === v)?.isMe ? null : v)}
          />
        ) : null}
      </Section>
      <TextField label="备注（选填）" value={note} onChangeText={setNote} placeholder="记账时写进备注，不填用名称" maxLength={50} />
      {id ? <Button title="删除这条常记" variant="danger" onPress={remove} /> : null}
    </Screen>
  )
}
