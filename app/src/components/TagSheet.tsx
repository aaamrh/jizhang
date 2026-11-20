import { useState } from 'react'
import { View } from 'react-native'
import { useRecentTags } from '../hooks/data'
import { useUi } from '../store/uiStore'
import { GUTTER, space } from '../theme'
import { cleanTags, MAX_TAGS, normalizeTag, TAG_MAX_LEN } from '../utils/tags'
import { Button } from './Button'
import { Chip } from './Chip'
import { Sheet } from './Sheet'
import { TextField } from './TextField'
import { Txt } from './Txt'

/** 记一笔时选标签：最近用过的在前，点一下选上 / 取消，也能写个新的。一笔最多 MAX_TAGS 个 */
export function TagSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean
  value: string[]
  onChange: (tags: string[]) => void
  onClose: () => void
}) {
  const recent = useRecentTags()
  const [draft, setDraft] = useState('')
  // 刚写的新标签还没记进账里，也要列出来
  const shown = cleanTags([...value, ...recent]).slice(0, 24)
  const toggle = (name: string) => {
    if (value.includes(name)) return onChange(value.filter((x) => x !== name))
    if (value.length >= MAX_TAGS) return useUi.getState().showToast(`一笔最多带 ${MAX_TAGS} 个标签`)
    onChange([...value, name])
  }
  const add = () => {
    const name = normalizeTag(draft)
    if (!name) return
    setDraft('')
    if (!value.includes(name)) toggle(name)
  }
  return (
    <Sheet visible={visible} onClose={onClose} title="标签" scroll={false}>
      <View style={{ paddingHorizontal: GUTTER, paddingBottom: space.md, gap: space.md }}>
        <Txt v="small" muted>
          {shown.length
            ? `最近用过的在前，一笔最多 ${MAX_TAGS} 个`
            : `比如“云南旅行”“装修”“报销”，跨分类做个记号，回头能看这个标签一共花了多少。一笔最多 ${MAX_TAGS} 个`}
        </Txt>
        {shown.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {shown.map((name) => (
              <Chip key={name} label={name} selected={value.includes(name)} onPress={() => toggle(name)} />
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <View style={{ flex: 1 }}>
            <TextField
              value={draft}
              onChangeText={setDraft}
              placeholder="写个新标签"
              maxLength={TAG_MAX_LEN}
              returnKeyType="done"
              onSubmitEditing={add}
              accessibilityLabel="新标签"
            />
          </View>
          <Button title="添加" size="md" onPress={add} disabled={!normalizeTag(draft)} />
        </View>
        <Button title="好了" variant="primary" onPress={onClose} />
      </View>
    </Sheet>
  )
}
