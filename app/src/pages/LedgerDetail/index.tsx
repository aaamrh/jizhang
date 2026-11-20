import { useLayoutEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { BookColorPicker, BookCover } from '../../components/BookCover'
import { MemberAvatar } from '../../components/MemberAvatar'
import { ledgerCover } from '../../utils/ledgerCover'
import { Button } from '../../components/Button'
import { confirm, confirmHold } from '../../components/dialogs'
import { Sheet } from '../../components/Sheet'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { VipMark } from '../../components/Vip'
import { useLedgers, useMembers } from '../../hooks/data'
import { familyActions } from '../../hooks/family'
import { GUTTER, size, space } from '../../theme'
import type { Member } from '../../types/domain'
import type { StackProps } from '../../types/navigation'

const ROLE_LABEL = { admin: '管理员', member: '已加入', profile: '家人档案' } as const

export default function LedgerDetailPage({ navigation, route }: StackProps<'LedgerDetail'>) {
  const { id } = route.params
  const ledger = useLedgers().find((l) => l.id === id)
  const members = useMembers(id).filter((m) => !m.removed)
  const [name, setName] = useState(ledger?.name ?? '')
  const [editing, setEditing] = useState<Member | null>(null) // 正在编辑的成员
  const [memberName, setMemberName] = useState('')
  const [pickCover, setPickCover] = useState(false)

  // 家庭账本页面里已经有大号账本名，标题只写“家人”，免得重复
  useLayoutEffect(() => navigation.setOptions({ title: ledger?.type === 'family' ? '家人' : (ledger?.name ?? '账本') }), [navigation, ledger?.name, ledger?.type])
  if (!ledger) {
    return (
      <Screen>
        <Txt muted>这个账本已经不在了</Txt>
      </Screen>
    )
  }
  const admin = ledger.myRole === 'admin'
  const cur = editing ? members.find((m) => m.id === editing.id) : undefined

  const edit = (m: Member) => {
    setEditing(m)
    setMemberName(m.nickname)
  }
  // 不做“家人档案”（没账号的家人）了：老人一般不记账（见 docs/决策.md）。旧数据里的档案不显示
  const people = members.filter((m) => m.role !== 'profile')
  const alone = people.length <= 1
  const remove = async (m: Member) => {
    if (await confirm(`把「${m.nickname}」移出账本？`, '他的手机上马上就看不到这个账本了；他记过的账保留，名字照常显示。想让他回来，需要重新发请帖。', '移出', true)) {
      setEditing(null)
      await familyActions.removeMember(id, m.id)
    }
  }
  const leave = async () => {
    if (await confirm(`退出「${ledger.name}」？`, '退出后，这台手机上不再显示这个账本；你记过的账留在账本里，家人还看得到。想回来需要家人重新邀请。', '退出', true)) {
      if (await familyActions.leave(id)) navigation.goBack()
    }
  }
  const dissolve = async () => {
    if (await confirmHold(`解散「${ledger.name}」？`, '所有家人都会看不到它，里面的账目、钱袋、家当会从每个人的手机上删除，不能恢复。', '按住解散')) {
      if (await familyActions.dissolve(id)) navigation.goBack()
    }
  }

  return (
    <Screen>
      {/* 账本头：封面（管理员点了能换）+ 名称 + 人数 */}
      <View style={{ alignItems: 'center', gap: space.xs, paddingTop: space.xs }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={admin ? '换封面' : '账本封面'}
          disabled={!admin}
          onPress={() => setPickCover(true)}
        >
          <BookCover color={ledgerCover(ledger)} title={ledger.name} width={size.bookHero} />
        </Pressable>
        <Txt v="title">{ledger.name}</Txt>
        <Txt v="caption" muted>
          {people.length} 位家人 · 我是{admin ? '管理员' : '成员'}
        </Txt>
      </View>

      {alone ? (
        <Section>
          <Txt>账本里还只有你一个人</Txt>
          <Txt v="small" muted>
            发张请帖给家人，大家各自用手机记到这里。
          </Txt>
          {admin ? <Button title="邀请家人" variant="primary" onPress={() => navigation.navigate('Invite', { ledgerId: id })} /> : null}
        </Section>
      ) : null}

      <Section list title="家人">
        {people.map((m) => (
          <ListRow
            key={m.id}
            leading={<MemberAvatar name={m.nickname} vip={m.isVip} px={size.circle - space.xs} />}
            title={m.isMe ? `${m.nickname}（我）` : m.nickname}
            subtitle={[ROLE_LABEL[m.role], m.elderMode ? '长辈模式' : ''].filter(Boolean).join(' · ')}
            value={m.isVip ? <VipMark /> : undefined}
            onPress={admin || m.isMe ? () => edit(m) : undefined}
          />
        ))}
      </Section>

      {admin ? (
        <>
          {!alone ? <Button title="邀请家人" variant="primary" onPress={() => navigation.navigate('Invite', { ledgerId: id })} /> : null}
          <TextField
            label="账本名称"
            value={name}
            onChangeText={setName}
            maxLength={20}
            accessibilityLabel="账本名称"
            suffix={<Button title="保存" variant="ghost" size="sm" disabled={!name.trim() || name === ledger.name} onPress={() => familyActions.rename(id, name)} />}
          />
          <Section list title="管理员操作">
            <ListRow title="解散账本" subtitle="所有家人都看不到，账目删除，不能恢复" danger chevron={false} onPress={dissolve} />
          </Section>
        </>
      ) : (
        <Section list>
          <ListRow title="退出账本" subtitle="你记过的账会留下，想回来需要重新邀请" danger chevron={false} onPress={leave} />
        </Section>
      )}

      <Sheet visible={pickCover} onClose={() => setPickCover(false)} title="换封面" scroll={false}>
        <View style={{ paddingHorizontal: GUTTER }}>
          <BookColorPicker
            value={ledgerCover(ledger)}
            onChange={async (c) => {
              setPickCover(false)
              await familyActions.setCover(id, c)
            }}
          />
        </View>
      </Sheet>

      <Sheet visible={!!cur} onClose={() => setEditing(null)} title={cur?.nickname} scroll={false}>
        {cur ? (
          <View style={{ paddingHorizontal: GUTTER, gap: space.md }}>
            <TextField
              label="名字"
              value={memberName}
              onChangeText={setMemberName}
              maxLength={20}
              suffix={
                <Button
                  title="保存"
                  variant="ghost"
                  size="sm"
                  disabled={!memberName.trim()}
                  onPress={() => familyActions.updateMember(id, cur.id, { nickname: memberName.trim() })}
                />
              }
            />
            {admin && !cur.isMe ? (
              <Section list>
                <ListRow
                  title="长辈模式"
                  subtitle="字更大、只留记一笔；他下次同步时生效"
                  switchValue={cur.elderMode}
                  onSwitch={async (v) => (await familyActions.updateMember(id, cur.id, { elderMode: v })) !== undefined}
                />
              </Section>
            ) : null}
            {admin && !cur.isMe ? <Button variant="danger" title="移出账本" onPress={() => remove(cur)} /> : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  )
}
