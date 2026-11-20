import { useLayoutEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { DateField } from '../../components/DateField'
import { attempt, showAlert } from '../../components/dialogs'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { assetActions } from '../../hooks/actions'
import { useAsset } from '../../hooks/data'
import type { StackProps } from '../../types/navigation'
import { dayLabel, today } from '../../utils/dates'
import { centsToInput, formatYuan, parseYuan } from '../../utils/money'

/** 手动添加已有物品（不动钱袋），或编辑名称、备注 */
export default function AssetFormPage({ navigation, route }: StackProps<'AssetForm'>) {
  const id = route.params?.id
  const a = useAsset(id ?? '')
  const [name, setName] = useState(a?.name ?? '')
  const [cost, setCost] = useState(a ? centsToInput(a.costCents) : '')
  const [date, setDate] = useState(a?.acquiredOn ?? today())
  const [note, setNote] = useState(a?.note ?? '')
  // 由支出生成的、或已出手的，买价和日期不能在这里改
  const locked = !!a && (a.fromTxn || a.status !== 'holding')

  useLayoutEffect(() => navigation.setOptions({ title: id ? '编辑家当' : '添加家当' }), [navigation, id])

  const save = () => {
    const cents = locked ? a!.costCents : parseYuan(cost)
    if (cents === null) return showAlert('提示', '请输入正确的买价')
    const v = { name, note, costCents: cents, acquiredOn: locked ? a!.acquiredOn : date }
    if (id) {
      if (attempt(() => assetActions.update(id, v))) navigation.goBack()
      return
    }
    // 新添加的直接进详情页，可以马上拍照、选计价方式
    let newId = ''
    if (attempt(() => (newId = assetActions.create(v)))) navigation.replace('AssetDetail', { id: newId })
  }

  return (
    <Screen footer={<Button title="保存" variant="primary" onPress={save} />}>
      <TextField label="名称" value={name} onChangeText={setName} placeholder="比如：手机、自行车" maxLength={30} autoFocus={!id} />
      {locked ? (
        <Txt v="small" muted>
          买价 {formatYuan(a!.costCents)}，{a!.acquiredOn} 买入。
          {a!.fromTxn ? '这件是记账时生成的，买价和日期请到那笔支出里改。' : '已出手的家当不能改买价和日期。'}
        </Txt>
      ) : (
        <>
          <TextField label="买价" value={cost} onChangeText={setCost} placeholder="0.00" prefix="¥" keyboardType="decimal-pad" />
          <Section list>
            <DateField label="买入日期" value={date} onChange={setDate} display={dayLabel} />
          </Section>
          {!id ? (
            <Txt v="caption" muted>
              手动添加的家当不会从钱袋里扣钱，适合记下以前买的东西。保存后可以拍张照片。
            </Txt>
          ) : null}
        </>
      )}
      <TextField label="备注" value={note} onChangeText={setNote} placeholder="选填" maxLength={100} />
    </Screen>
  )
}
