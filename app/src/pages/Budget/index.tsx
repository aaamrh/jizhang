import { useState } from 'react'
import { View } from 'react-native'
import { BudgetLineRow } from '../../components/Bars'
import { Button } from '../../components/Button'
import { CategoryIcon } from '../../components/CategoryIcon'
import { attempt, showAlert } from '../../components/dialogs'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { budgetActions } from '../../hooks/actions'
import { useBudgets, useBudgetStatus, useCategories, useCurrentLedger } from '../../hooks/data'
import { colors, size } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { monthOf, today } from '../../utils/dates'
import { centsToInput, parseYuan } from '../../utils/money'

/** 空 = 不设（0）；不合法返回 null */
const parse = (v: string) => (v.trim() === '' ? 0 : parseYuan(v))

export default function BudgetPage({ navigation }: StackProps<'Budget'>) {
  const ledger = useCurrentLedger()
  const budgets = useBudgets()
  const cats = useCategories('expense')
  const status = useBudgetStatus(monthOf(today()))
  const initial = (id: string | null) => {
    const b = budgets.find((x) => x.categoryId === id)
    return b ? centsToInput(b.amountCents) : ''
  }
  const [total, setTotal] = useState(() => initial(null))
  const [perCat, setPerCat] = useState<Record<string, string>>(() =>
    Object.fromEntries(budgets.filter((b) => b.categoryId).map((b) => [b.categoryId!, centsToInput(b.amountCents)])),
  )

  const save = () => {
    const t = parse(total)
    const entries = Object.entries(perCat).map(([id, v]) => [id, parse(v)] as const)
    if (t === null || entries.some(([, v]) => v === null)) return showAlert('提示', '请输入正确的金额，最多两位小数')
    const ok = attempt(() => {
      budgetActions.set(null, t)
      for (const [id, v] of entries) budgetActions.set(id, v)
    })
    if (ok) navigation.goBack()
  }

  return (
    <Screen footer={<Button title="保存" variant="primary" onPress={save} />}>
      <Section title="每月总预算">
        <TextField display value={total} onChangeText={setTotal} placeholder="不设" prefix="¥" keyboardType="decimal-pad" accessibilityLabel="每月总预算" />
        <Txt v="caption" muted>
          给「{ledger?.name}」定一个每月最多花多少。退款会冲减，买家当也算花钱。留空表示不设。
        </Txt>
        {status.total ? <BudgetLineRow line={status.total} /> : null}
      </Section>

      <Section list>
        <ListRow glyph="treasure-bowl" iconColor={colors.gold} title="攒钱目标" subtitle="立个目标，存满记入心愿" onPress={() => navigation.navigate('Achievements')} />
      </Section>

      <Section list title="分类预算（选填）">
        {cats.map((c) => (
          <ListRow
            key={c.id}
            title={c.name}
            leading={<CategoryIcon icon={c.icon} color={c.color} />}
            value={
              <View style={{ width: size.buttonLg * 2.5 }}>
                <TextField
                  value={perCat[c.id] ?? ''}
                  onChangeText={(v) => setPerCat((p) => ({ ...p, [c.id]: v }))}
                  placeholder="不设"
                  align="right"
                  keyboardType="decimal-pad"
                  accessibilityLabel={`${c.name}预算`}
                />
              </View>
            }
          />
        ))}
      </Section>
    </Screen>
  )
}
