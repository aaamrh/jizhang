import { useLayoutEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { DateField } from '../../components/DateField'
import { attempt, confirm, showAlert } from '../../components/dialogs'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { goalActions } from '../../hooks/actions'
import { useGoals } from '../../hooks/data'
import type { StackProps } from '../../types/navigation'
import { dayLabel, today } from '../../utils/dates'
import { goalCopy, tierName, tierOf } from '../../utils/goals'
import { useUi } from '../../store/uiStore'
import { centsToInput, parseYuan } from '../../utils/money'

/** 默认期限：三个月后 */
function threeMonthsLater() {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 立一个攒钱目标 / 修改目标 */
export default function GoalFormPage({ navigation, route }: StackProps<'GoalForm'>) {
  const id = route.params?.id
  const goal = useGoals().find((g) => g.id === id)
  const [name, setName] = useState(goal?.name ?? '')
  const [amount, setAmount] = useState(goal ? centsToInput(goal.targetCents) : '')
  const [hasDeadline, setHasDeadline] = useState(goal ? !!goal.deadline : true)
  const [deadline, setDeadline] = useState(goal?.deadline ?? threeMonthsLater())

  useLayoutEffect(() => navigation.setOptions({ title: id ? '修改目标' : '立个目标' }), [navigation, id])

  const cents = parseYuan(amount)
  const tier = cents && cents > 0 ? tierName(tierOf(cents)) : null

  const save = () => {
    if (cents === null || cents <= 0) return showAlert('提示', '请输入目标金额')
    if (hasDeadline && deadline < today()) return showAlert('提示', '期限不能早于今天')
    const v = { name, targetCents: cents, deadline: hasDeadline ? deadline : null }
    if (!attempt(() => (id ? goalActions.update(id, v) : goalActions.create(v)))) return
    if (!id) useUi.getState().showVerse(goalCopy('create'))
    navigation.goBack()
  }
  const putAway = async () => {
    if (await confirm('先把这个目标收起来？', '储钱罐里的钱还在，随时可以转出。想好了，再立一个新的也行。', '收起来')) {
      if (attempt(() => goalActions.archive(id!))) navigation.goBack()
    }
  }

  return (
    <Screen footer={<Button title={id ? '保存' : '立下目标'} variant="primary" onPress={save} />}>
      <Section plain>
        <TextField label="攒钱做什么" value={name} onChangeText={setName} placeholder="比如：年底旅行、换新手机" maxLength={16} />
        <TextField label="目标金额" value={amount} onChangeText={setAmount} placeholder="0" prefix="¥" keyboardType="decimal-pad" display />
        {tier ? (
          <Txt v="small" muted>
            存满可得「{tier}」匾一块，金额越大，牌匾越气派
          </Txt>
        ) : null}
      </Section>
      <Section list>
        <ListRow title="设个期限" subtitle="到期前每月该存多少，会帮你算好" switchValue={hasDeadline} onSwitch={setHasDeadline} />
        {hasDeadline ? <DateField label="期限" value={deadline} onChange={setDeadline} display={dayLabel} /> : null}
      </Section>
      <Txt v="small" muted>
        立下目标后会有一个专属储钱罐。从银行卡、微信「存一笔」进去，算转账，不算支出。攒够了，它会变成一块牌匾挂进心愿；钱用在了想做的事上，再盖一枚“圆梦”印。攒钱是为了好好生活，别太苛刻自己。
      </Txt>
      {id && goal?.status === 'active' ? <Button title="先收起来" variant="ghost" onPress={putAway} /> : null}
    </Screen>
  )
}
