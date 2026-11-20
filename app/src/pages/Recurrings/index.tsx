import { Button } from '../../components/Button'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Plus } from '../../components/icons/ui'
import { ListRow } from '../../components/ListRow'
import { EmptyState } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { useRecurrings } from '../../hooks/data'
import { expenseColor, incomeColor } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { dayLabel } from '../../utils/dates'
import { formatPlain } from '../../utils/money'
import { freqLabel } from '../../utils/recurring'

/** 周期记账：房租、工资、会员续费这类固定的账，到日子自动记上 */
export default function RecurringsPage({ navigation }: StackProps<'Recurrings'>) {
  const list = useRecurrings()
  return (
    <Screen footer={<Button title="添加定时记账" icon={Plus} variant="primary" onPress={() => navigation.navigate('RecurringForm', {})} />}>
      <Txt v="small" muted>
        比如每月 5 号的房租、每月 10 号的工资、每年续一次的会员。到了日子，打开账房就自动记上一笔，不用再手动记。
      </Txt>
      {list.length === 0 ? (
        <EmptyState glyph="cycle" text="还没有定时记账" />
      ) : (
        <Section list>
          {list.map((r) => (
            <ListRow
              key={r.id}
              leading={r.categoryIcon ? <CategoryIcon icon={r.categoryIcon} color={r.categoryColor} /> : undefined}
              title={r.note || r.categoryName || '定时记账'}
              subtitle={`${freqLabel(r)} · ${r.paused ? '已暂停' : r.next ? `下次 ${dayLabel(r.next)}` : '已结束'}${r.walletName ? ` · ${r.walletName}` : ''}`}
              value={
                <Txt serif color={r.type === 'income' ? incomeColor : expenseColor}>
                  {r.type === 'income' ? '+' : '-'}
                  {formatPlain(r.amountCents)}
                </Txt>
              }
              onPress={() => navigation.navigate('RecurringForm', { id: r.id })}
            />
          ))}
        </Section>
      )}
    </Screen>
  )
}
