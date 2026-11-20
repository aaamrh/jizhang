import { useLayoutEffect, useState } from 'react'
import { View } from 'react-native'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { attempt, confirm } from '../../components/dialogs'
import { Ellipsis } from '../../components/icons/ui'
import { EmptyState } from '../../components/Misc'
import { NavAction } from '../../components/NavBar'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Sheet } from '../../components/Sheet'
import { TextField } from '../../components/TextField'
import { TxnRow } from '../../components/TxnItem'
import { Txt } from '../../components/Txt'
import { tagActions } from '../../hooks/actions'
import { useTagTxns } from '../../hooks/data'
import { useUi } from '../../store/uiStore'
import { amountColor, GUTTER, incomeColor, space } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { dayLabel } from '../../utils/dates'
import { formatPlain } from '../../utils/money'
import { normalizeTag, spendByMonth, TAG_MAX_LEN, tagTotals } from '../../utils/tags'

const md = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`

/** 一个标签的所有账：不分月份，合计花了多少、从哪天到哪天、跨月时分月看；右上角改名、删除 */
export default function TagPage({ navigation, route }: StackProps<'Tag'>) {
  const name = route.params.name
  const list = useTagTxns(name)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(name)

  const total = tagTotals(list.map((x) => ({ type: x.type, amountCents: x.amountCents, tags: [name] })))[0]
  const months = spendByMonth(list)
  const first = list.at(-1)?.date
  const last = list[0]?.date

  const remove = async () => {
    const ok = await confirm('删除标签', `「${name}」会从 ${list.length} 笔账上去掉，账本身不删。`, '删除', true)
    if (ok && attempt(() => tagActions.remove(name))) navigation.goBack()
  }
  const menu = () =>
    useUi.getState().showActions({
      title: `标签「${name}」`,
      items: [
        {
          label: '改名',
          onPress: () => {
            setDraft(name)
            setRenaming(true)
          },
        },
        { label: '删除标签', danger: true, onPress: () => void remove() },
      ],
    })
  useLayoutEffect(() => navigation.setOptions({ headerRight: () => <NavAction icon={Ellipsis} label="更多" onPress={menu} /> }))

  const rename = () => {
    const to = normalizeTag(draft)
    if (!attempt(() => tagActions.rename(name, to))) return
    setRenaming(false)
    if (to) navigation.setParams({ name: to })
  }

  return (
    <Screen>
      <Section>
        <View style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.sm }}>
          <Chip label={name} />
          {total ? (
            <>
              <Txt v="caption" muted>
                一共花了
              </Txt>
              <Txt v="amount" color={amountColor(-total.spendCents)}>
                {formatPlain(total.spendCents)}
              </Txt>
              {total.incomeCents > 0 ? (
                <Txt v="small" muted>
                  收入 <Txt v="small" color={incomeColor}>{formatPlain(total.incomeCents)}</Txt>
                </Txt>
              ) : null}
              <Txt v="caption" muted>
                {first && last && first !== last ? `${md(first)} 到 ${md(last)}` : first ? md(first) : ''} · {list.length} 笔 · 不分月份
              </Txt>
              {months.length > 1 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs, paddingTop: space.xs }}>
                  {months.map((m) => (
                    <Chip key={m.month} small label={`${Number(m.month.slice(5, 7))}月 ${formatPlain(m.cents)}`} />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </Section>

      {list.length === 0 ? (
        <EmptyState glyph="brush" text="还没有账带这个标签" />
      ) : (
        <Section list title="每一笔">
          {list.map((t) => (
            <TxnRow key={t.id} t={t} who={dayLabel(t.date)} navigation={navigation} />
          ))}
        </Section>
      )}

      <Sheet visible={renaming} onClose={() => setRenaming(false)} title="改名" scroll={false}>
        <View style={{ paddingHorizontal: GUTTER, paddingBottom: space.md, gap: space.md }}>
          <TextField value={draft} onChangeText={setDraft} maxLength={TAG_MAX_LEN} autoFocus accessibilityLabel="标签名" />
          <Txt v="caption" muted>
            带这个标签的账都会跟着改。改成已有的标签名，就合并成一个。
          </Txt>
          <Button title="改好了" variant="primary" onPress={rename} disabled={!normalizeTag(draft)} />
        </View>
      </Sheet>
    </Screen>
  )
}
