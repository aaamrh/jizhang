import { useLayoutEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { attempt, confirm, showAlert } from '../../components/dialogs'
import { ListRow } from '../../components/ListRow'
import { Picker } from '../../components/Picker'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { walletActions } from '../../hooks/actions'
import { useWallet } from '../../hooks/data'
import { LIABILITY_KINDS, WALLET_KIND_LABEL, type WalletKind } from '../../types/domain'
import type { StackProps } from '../../types/navigation'
import { parseYuan } from '../../utils/money'

const KINDS = (Object.keys(WALLET_KIND_LABEL) as WalletKind[]).filter((k) => k !== 'jar') // 储钱罐只由攒钱目标自动建

export default function WalletFormPage({ navigation, route }: StackProps<'WalletForm'>) {
  const id = route.params?.id
  const w = useWallet(id)
  const [name, setName] = useState(w?.name ?? '')
  const [kind, setKind] = useState<WalletKind>(w?.kind ?? 'bank')
  const [initial, setInitial] = useState('')
  const liability = LIABILITY_KINDS.includes(kind)

  useLayoutEffect(() => navigation.setOptions({ title: id ? '编辑钱袋' : '添加钱袋' }), [navigation, id])

  const save = () => {
    if (id) {
      if (attempt(() => walletActions.update(id, { name: name || WALLET_KIND_LABEL[kind], kind }))) navigation.goBack()
      return
    }
    const cents = parseYuan(initial === '' ? '0' : initial)
    if (cents === null) return showAlert('提示', '金额不正确')
    const v = { name: name.trim() || WALLET_KIND_LABEL[kind].replace(/（.*）/, ''), kind, initialCents: liability ? -cents : cents }
    if (attempt(() => walletActions.create(v))) navigation.goBack()
  }

  const toggleArchive = () => {
    if (attempt(() => walletActions.archive(id!, !w!.archived))) navigation.goBack()
  }

  const remove = async () => {
    if (walletActions.hasTxns(id!)) return showAlert('不能删除', '这个钱袋记过账，可以归档：账目保留，记账时不再出现。')
    if ((await confirm(`删除「${w!.name}」？`, '删除后不能恢复。', '删除', true)) && attempt(() => walletActions.remove(id!))) navigation.goBack()
  }

  return (
    <Screen footer={<Button title="保存" variant="primary" onPress={save} />}>
      <Section list>
        <Picker
          label="种类"
          value={kind}
          options={KINDS.map((k) => ({ value: k, label: WALLET_KIND_LABEL[k], sub: LIABILITY_KINDS.includes(k) ? '负债' : undefined }))}
          onChange={(k) => setKind(k as WalletKind)}
        />
      </Section>
      <TextField label="名称" value={name} onChangeText={setName} placeholder={WALLET_KIND_LABEL[kind]} maxLength={20} />
      {id ? (
        <Section list title="改名称、种类不影响已有账目">
          <ListRow title="校准余额" onPress={() => navigation.navigate('Calibrate', {})} />
          <ListRow title={w?.archived ? '取消归档' : '归档'} subtitle={w?.archived ? undefined : '账目保留，记账时不再出现'} onPress={toggleArchive} />
          <ListRow title="删除" danger chevron={false} onPress={remove} />
        </Section>
      ) : (
        <TextField
          label={liability ? '现在欠多少' : '现在有多少'}
          value={initial}
          onChangeText={setInitial}
          keyboardType="decimal-pad"
          prefix="¥"
          placeholder="0"
          hint={liability ? '信用卡、花呗的欠款会从净资产里扣掉。还款时用「转账」，从银行卡转到这里。' : undefined}
        />
      )}
    </Screen>
  )
}
