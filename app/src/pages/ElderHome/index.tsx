import { Pressable, View } from 'react-native'
import { Button } from '../../components/Button'
import { confirm } from '../../components/dialogs'
import { EmptyState } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Seal } from '../../components/Seal'
import { Txt } from '../../components/Txt'
import { TxnItem } from '../../components/TxnItem'
import { useMonthView } from '../../hooks/data'
import { useSettings } from '../../store/settingsStore'
import { expenseColor, space } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { monthOf, today } from '../../utils/dates'
import { formatYuan } from '../../utils/money'

/** 长辈模式首页“这个月”：大字、只有花了多少和记一笔 */
export default function ElderHomePage({ navigation }: StackProps<'ElderHome'>) {
  const day = today()
  const { summary, groups } = useMonthView(monthOf(day), false)
  const todayCents = groups.find((g) => g.date === day)?.expenseCents ?? 0

  const exit = async () => {
    if (await confirm('退出长辈模式？', '恢复完整的账房界面，账目不受影响。', '退出')) useSettings.getState().setElderMode(false)
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Seal char="账" filled />
        <Txt v="title">这个月</Txt>
      </View>
      <Section>
        <Txt muted>这个月花了</Txt>
        <Txt v="display" color={expenseColor}>{formatYuan(summary.expenseCents)}</Txt>
        <Txt muted>今天花了 {formatYuan(todayCents)}</Txt>
      </Section>
      <Button title="记一笔" variant="primary" onPress={() => navigation.navigate('ElderEntry')} />

      {groups.length === 0 ? (
        <EmptyState glyph="tab-ledger" text="这个月还没有记账" />
      ) : (
        groups.map((g) => (
          <Section key={g.date} list title={g.label}>
            {g.items.map((t) => (
              <TxnItem key={t.id} t={t} />
            ))}
          </Section>
        ))
      )}

      <Pressable accessibilityRole="button" onPress={exit} style={{ paddingVertical: space.xl }}>
        <Txt v="small" muted center>
          退出长辈模式
        </Txt>
      </Pressable>
    </Screen>
  )
}
