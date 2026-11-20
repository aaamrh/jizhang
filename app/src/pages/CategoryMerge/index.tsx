import { CategoryIcon } from '../../components/CategoryIcon'
import { attempt, confirm } from '../../components/dialogs'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { categoryActions } from '../../hooks/actions'
import { useCategories, useCategory } from '../../hooks/data'
import type { StackProps } from '../../types/navigation'

export default function CategoryMergePage({ navigation, route }: StackProps<'CategoryMerge'>) {
  const from = useCategory(route.params.id)
  const targets = useCategories(from?.type, true).filter((c) => c.id !== from?.id)
  if (!from)
    return (
      <Screen>
        <Txt muted>分类已经不存在了</Txt>
      </Screen>
    )

  const merge = async (intoId: string, intoName: string) => {
    const ok = await confirm('合并分类', `「${from.name}」的全部账目会转到「${intoName}」，然后「${from.name}」消失。不能撤销。`, '合并', true)
    // 合并后原分类已不存在，连同编辑页一起退出
    if (ok && attempt(() => categoryActions.merge(from.id, intoId))) navigation.pop(2)
  }

  return (
    <Screen>
      <Section list title={`把「${from.name}」合并到`}>
        {targets.map((c) => (
          <ListRow key={c.id} title={c.name} leading={<CategoryIcon icon={c.icon} color={c.color} />} onPress={() => merge(c.id, c.name)} />
        ))}
      </Section>
    </Screen>
  )
}
