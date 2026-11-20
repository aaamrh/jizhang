import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { BookColorPicker, BookCover } from '../../components/BookCover'
import { MemberAvatar } from '../../components/MemberAvatar'
import { RetroGlyph } from '../../components/RetroGlyph'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { ShareFromField } from '../../components/ShareFromField'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { familyActions } from '../../hooks/family'
import { useAuth } from '../../store/authStore'
import { colors, expenseColor, iconSize, size, space } from '../../theme'
import { useUi } from '../../store/uiStore'
import type { StackProps } from '../../types/navigation'
import { today } from '../../utils/dates'
import { VIP_NAME } from '../../utils/copy'
import { formatPlain } from '../../utils/money'
import { type BookColor, DEFAULT_COVER, FAMILY_NAME_SUGGESTIONS } from '../../utils/ledgerCover'

/** 还不是大掌柜：先看看家庭账本是什么样（示意），再决定要不要开通 */
function Preview({ onVip, onJoin }: { onVip: () => void; onJoin: () => void }) {
  // 示意：每笔写的是“谁记的”，不分“谁花的”（见 docs/决策.md）
  const rows = [
    { who: '妈妈', what: '买菜', cents: 3600 },
    { who: '爸爸', what: '医疗 · 降压药', cents: 5800 },
    { who: '我', what: '通讯网费 · 爸妈的话费', cents: 5000 },
  ]
  return (
    <>
      <View style={{ alignItems: 'center', gap: space.xs, paddingTop: space.xs }}>
        <Txt v="title" center>
          一家人，一本账
        </Txt>
        <Txt v="small" muted center>
          各自在自己的账本里记，汇到一起看
        </Txt>
      </View>
      <Section title="示意">
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.md }}>
          {['我', '妈妈', '爸爸'].map((n) => (
            <View key={n} style={{ alignItems: 'center' }}>
              <MemberAvatar name={n} />
              <Txt v="caption" muted>
                {n}
              </Txt>
            </View>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.what} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.row }}>
            <MemberAvatar name={r.who} px={size.circle - space.xs} />
            <View style={{ flex: 1 }}>
              <Txt numberOfLines={1}>{r.what}</Txt>
              <Txt v="caption" muted>
                {r.who}记的
              </Txt>
            </View>
            <Txt serif color={expenseColor}>
              -{formatPlain(r.cents)}
            </Txt>
          </View>
        ))}
      </Section>
      <Section list={false} title="能做什么">
        {[
          '家人免费加入，各记各的，汇总到一起看',
          '每笔都留着是谁记的，月底看各自记了多少',
          '可以给长辈远程打开长辈模式：字更大、只留记一笔',
        ].map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' }}>
            <RetroGlyph name="chinese-knot" color={colors.seal} px={iconSize.inline} />
            <Txt v="small" style={{ flex: 1 }}>
              {t}
            </Txt>
          </View>
        ))}
      </Section>
      <Button title={`开通${VIP_NAME}，建家庭账本`} variant="primary" onPress={onVip} />
      <Button title="家人发了邀请码？直接加入（免费）" variant="ghost" onPress={onJoin} />
    </>
  )
}

/** 新建家庭账本：起名 + 选封面 + 自己的账从哪天起共享 → 发请帖（只邀请装了账房的家人，不做没账号的“家人档案”） */
export default function FamilyCreatePage({ navigation }: StackProps<'FamilyCreate'>) {
  const user = useAuth((s) => s.user)
  const [name, setName] = useState('')
  const [cover, setCover] = useState<BookColor>(DEFAULT_COVER.family)
  const [shareFrom, setShareFrom] = useState(today())
  const [busy, setBusy] = useState(false)

  if (!user?.isVip) {
    return (
      <Screen>
        <Preview
          onVip={() => useUi.getState().showVipSheet('family')}
          onJoin={() => navigation.replace('Join', {})}
        />
      </Screen>
    )
  }

  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const id = await familyActions.create(name, cover, shareFrom)
    setBusy(false)
    if (id) navigation.replace('Invite', { ledgerId: id })
  }

  return (
    <Screen>
      <Section title="账本名称">
        <TextField value={name} onChangeText={setName} placeholder="比如：我们家" maxLength={20} accessibilityLabel="家庭账本名称" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {FAMILY_NAME_SUGGESTIONS.map((n) => (
            <Chip key={n} label={n} selected={name === n} onPress={() => setName(n)} />
          ))}
        </View>
      </Section>
      <Section title="封面">
        <View style={{ alignItems: 'center', paddingVertical: space.xs }}>
          <BookCover color={cover} title={name.trim() || FAMILY_NAME_SUGGESTIONS[0]} width={size.bookHero} />
        </View>
        <BookColorPicker value={cover} onChange={setCover} />
      </Section>
      <ShareFromField value={shareFrom} onChange={setShareFrom} ledgerName={name.trim() || '这个家庭账本'} />
      <Button title="建好了，下一步" variant="primary" disabled={!name.trim() || busy} onPress={create} />
      <Txt v="caption" muted center>
        最多 10 位家人，加入免费
      </Txt>
    </Screen>
  )
}
