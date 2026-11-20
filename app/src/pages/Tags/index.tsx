import { EmptyState } from '../../components/Misc'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { useAllTags } from '../../hooks/data'
import { amountColor } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { formatPlain } from '../../utils/money'

/** 所有标签：不分时间，按花的钱从多到少；点开看每一笔、改名、删除 */
export default function TagsPage({ navigation }: StackProps<'Tags'>) {
  const tags = useAllTags()
  return (
    <Screen>
      <Txt v="small" muted>
        标签是跨分类的记号，比如“云南旅行”“装修”“报销”。在记一笔第二行点“标签”添加。点开能看这个标签的每一笔，也能改名、删除。
      </Txt>
      {tags.length === 0 ? (
        <EmptyState glyph="brush" text="还没有标签" />
      ) : (
        <Section list>
          {tags.map((g) => (
            <ListRow
              key={g.name}
              title={g.name}
              subtitle={`${g.count} 笔`}
              value={
                <Txt serif color={amountColor(-g.spendCents)}>
                  {formatPlain(g.spendCents)}
                </Txt>
              }
              onPress={() => navigation.navigate('Tag', { name: g.name })}
            />
          ))}
        </Section>
      )}
    </Screen>
  )
}
