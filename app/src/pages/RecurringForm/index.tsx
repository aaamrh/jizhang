import { useLayoutEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { CategoryGrid } from '../../components/CategoryGrid'
import { Segmented } from '../../components/Chip'
import { DateField } from '../../components/DateField'
import { attempt, confirm, showAlert } from '../../components/dialogs'
import { ListRow } from '../../components/ListRow'
import { Picker } from '../../components/Picker'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { recurringActions } from '../../hooks/actions'
import { useCategories, useWallets } from '../../hooks/data'
import type { StackProps } from '../../types/navigation'
import { addDays, dayLabel, today } from '../../utils/dates'
import { centsToInput, parseYuan } from '../../utils/money'
import { anchorOf, freqLabel, nextDate, occurrences, periodEnd, type Repeat } from '../../utils/recurring'
import { RepeatPicker } from '../../components/RepeatPicker'

const TYPES = [
  { value: 'expense' as const, label: '支出' },
  { value: 'income' as const, label: '收入' },
]

/** 新建 / 编辑周期账：金额、分类、钱袋、多久一次、从哪天开始、到哪天结束（可不设） */
export default function RecurringFormPage({ navigation, route }: StackProps<'RecurringForm'>) {
  const id = route.params?.id
  const fromTxn = id ? undefined : route.params?.fromTxn
  // 从一笔账设为周期：用那笔预填，那一笔算这一期（这个月、这周……）记过了，从下一期记起
  const [draft] = useState(() => (fromTxn ? recurringActions.draftFromTxn(fromTxn) : undefined))
  const [init] = useState(() => (id ? recurringActions.get(id) : draft ? { ...draft, doneThrough: null, paused: false } : undefined))
  const [type, setType] = useState<'expense' | 'income'>(init?.type ?? 'expense')
  const [amount, setAmount] = useState(init ? centsToInput(init.amountCents) : '')
  const [categoryId, setCategoryId] = useState<string | null>(init?.categoryId ?? null)
  const [walletId, setWalletId] = useState<string | null>(init?.walletId ?? null)
  const [note, setNote] = useState(init?.note ?? '')
  const [repeat, setRepeat] = useState<Repeat>({ freq: init?.freq ?? 'month', day: init?.day ?? null, month: init?.month ?? null })
  const [startDate, setStartDate] = useState(init?.startDate ?? today())
  const [hasEnd, setHasEnd] = useState(!!init?.endDate)
  const [endDate, setEndDate] = useState(init?.endDate ?? addDays(today(), 365))
  const [paused, setPaused] = useState(init?.paused ?? false)
  const cats = useCategories(type).filter((c) => !c.hidden)
  const wallets = useWallets()
  const wallet = walletId ?? wallets[0]?.id ?? null

  useLayoutEffect(() => navigation.setOptions({ title: id ? '定时记账' : draft ? '设为定时记账' : '添加定时记账' }), [navigation, id, draft])

  const rule = { ...repeat, startDate, endDate: hasEnd ? endDate : null }
  // 已经记到哪天：编辑时是上次记到的；从一笔账设的，是那一笔所在这一期的最后一天
  const done = draft ? (draft.txnDate >= startDate ? periodEnd(repeat.freq, draft.txnDate) : null) : (init?.doneThrough ?? null)
  // 开始日期在今天或之前：保存时把还没记过的补上（从记到的后一天算）
  const from = done && done >= startDate ? addDays(done, 1) : startDate
  const backfill = paused ? 0 : occurrences(rule, from, today()).length
  const next = paused || backfill ? null : nextDate(rule, addDays(from > today() ? from : today(), -1))

  const save = () => {
    const cents = parseYuan(amount)
    if (cents === null || cents <= 0) return showAlert('提示', '请输入正确的金额')
    if (!categoryId) return showAlert('提示', '请选择分类')
    const v = { type, amountCents: cents, categoryId, walletId: wallet ?? '', note, ...rule }
    const ok = attempt(() => {
      // 从一笔账设的：那一笔的日期在开始日之后（含）就算记过了
      if (!id) return recurringActions.create(v, done)
      // 先暂停再改（免得改的时候顺手补记）；恢复放在最后
      if (paused && !init?.paused) recurringActions.setPaused(id, true)
      recurringActions.update(id, v)
      if (!paused && init?.paused) recurringActions.setPaused(id, false)
    })
    if (ok) navigation.goBack()
  }
  const remove = async () => {
    if (await confirm('删除这条定时记账？', '以后不再自动记。已经记下的账不受影响。', '删除', true)) {
      if (attempt(() => recurringActions.remove(id!))) navigation.goBack()
    }
  }

  return (
    <Screen footer={<Button title="保存" variant="primary" onPress={save} />}>
      <Segmented options={TYPES} value={type} onChange={(t) => (setType(t), setCategoryId(null))} />
      {/* 最要紧的是“什么时候记”，放最上面（用户：怎么把最重要的日期放在了最下面） */}
      <Section title="什么时候记" plain>
        <RepeatPicker value={repeat} onChange={(v) => v && setRepeat(v)} date={startDate} />
      </Section>
      <Section list>
        <DateField label="从哪天开始" value={startDate} onChange={setStartDate} display={dayLabel} />
        <ListRow title="设个结束日期" subtitle="比如房租合同到期那天" switchValue={hasEnd} onSwitch={setHasEnd} />
        {hasEnd ? <DateField label="到哪天结束" value={endDate} onChange={setEndDate} display={dayLabel} /> : null}
        {id ? <ListRow title="暂停" subtitle="暂停期间不自动记，打开后从今天接着记" switchValue={paused} onSwitch={setPaused} /> : null}
      </Section>
      <Txt v="small" muted>
        {freqLabel(rule)}记一笔{repeat.freq !== 'day' && repeat.freq !== 'week' && anchorOf(rule).day > 28 ? '（没有这一天的月份记在月底）' : ''}。
        {backfill > 0 ? (backfill === 1 && occurrences(rule, today(), today()).length ? '保存后今天这笔马上记上。' : `保存后会把到今天的 ${backfill} 笔一起记上。`) : next ? `下次 ${dayLabel(next)}。` : ''}
        自动记的账不算进连续记账天数。
      </Txt>
      <Section plain>
        <TextField label="金额" value={amount} onChangeText={setAmount} placeholder="0.00" prefix="¥" keyboardType="decimal-pad" display />
        <TextField label="备注（选填）" value={note} onChangeText={setNote} placeholder="比如：房租、工资、视频会员" maxLength={50} />
      </Section>
      <Section title="分类" plain>
        <CategoryGrid items={cats} value={categoryId} onChange={setCategoryId} />
      </Section>
      <Section list>
        <Picker label="钱袋" value={wallet} options={wallets.map((w) => ({ value: w.id, label: w.name }))} onChange={setWalletId} />
      </Section>
      {id ? <Button title="删除这条定时记账" variant="danger" onPress={remove} /> : null}
    </Screen>
  )
}
