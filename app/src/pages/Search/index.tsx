import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Search } from '../../components/icons/ui'
import { EmptyState } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { TxnRow } from '../../components/TxnItem'
import { useSearch } from '../../hooks/data'
import { colors } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { dayLabel } from '../../utils/dates'

export default function SearchPage({ navigation }: StackProps<'Search'>) {
  const [q, setQ] = useState('')
  const results = useSearch(q)
  return (
    <Screen>
      <TextField
        value={q}
        onChangeText={setQ}
        placeholder="备注、分类、标签或金额，比如 火锅、报销、32.5"
        autoFocus
        returnKeyType="search"
        accessibilityLabel="搜索"
        prefix={<Icon as={Search} color={colors.ink3} />}
      />
      {q.trim() === '' ? null : results.length === 0 ? (
        <EmptyState glyph="compass" text="没有找到" />
      ) : (
        <Section list title={`找到 ${results.length} 笔${results.length === 200 ? '（只显示最近 200 笔）' : ''}`}>
          {results.map((t) => (
            <TxnRow key={t.id} t={t} who={dayLabel(t.date)} navigation={navigation} />
          ))}
        </Section>
      )}
    </Screen>
  )
}
