import { LedgerCoverSlot } from '../../components/BookCover'
import { Button } from '../../components/Button'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { accountActions } from '../../hooks/account'
import { useFamilies, useLedgers } from '../../hooks/data'
import { useAuth } from '../../store/authStore'
import { useSettings } from '../../store/settingsStore'
import type { StackProps } from '../../types/navigation'
import { VIP_NAME } from '../../utils/copy'

/**
 * 我的账本 + 家庭账本（见 docs/需求.md 第 11 节）。家庭账本是一家人各自账的汇总，可以同时在好几个家庭里
 * （比如“我们家”和“爸妈家”），每个家庭各自选从哪天起把我的账汇进去。
 */
export default function LedgersPage({ navigation }: StackProps<'Ledgers'>) {
  const { user, syncConsent } = useAuth()
  const ledgers = useLedgers()
  const setFamilyView = useSettings((s) => s.setFamilyView)
  const main = ledgers.find((l) => l.type === 'personal')
  const { families, viewed } = useFamilies()
  const online = !!user && syncConsent

  /** familyId 为 '' 看我的账本 */
  const look = (familyId: string) => {
    setFamilyView(familyId)
    navigation.navigate('Tabs', { screen: 'Home' })
  }

  return (
    <Screen>
      {main ? (
        <Section list title="我的账本">
          <ListRow
            leading={<LedgerCoverSlot ledger={main} />}
            title={main.name}
            subtitle={`${!viewed ? '正在看 · ' : ''}只有自己能看，记账都记在这里`}
            onPress={() => look('')}
          />
        </Section>
      ) : null}

      {!online ? (
        <Section plain>
          <Txt v="small" muted>
            {user ? '家庭账本把一家人各自记的账汇到一起，需要先开启云同步。' : '家庭账本需要登录：一家人各自记，汇到一起看。'}
          </Txt>
          {user ? (
            <Button title="开启云同步" variant="primary" onPress={() => void accountActions.turnOnSync()} />
          ) : (
            <Button title="登录" variant="primary" onPress={() => navigation.navigate('Login')} />
          )}
        </Section>
      ) : (
        <>
          {families.map((f, i) => (
            <Section key={f.id} list title={i === 0 ? '家庭账本' : undefined}>
              <ListRow
                leading={<LedgerCoverSlot ledger={f} />}
                title={f.name}
                subtitle={`${viewed?.id === f.id ? '正在看 · ' : ''}${f.myRole === 'admin' ? '我是管理员' : '成员'} · 一家人的账汇在这里`}
                onPress={() => look(f.id)}
              />
              <ListRow glyph="house" title="家人和设置" subtitle="邀请家人、改名、换封面、退出或解散" onPress={() => navigation.navigate('LedgerDetail', { id: f.id })} />
            </Section>
          ))}
          <Section list title={families.length ? undefined : '家庭账本'}>
            <ListRow
              glyph="house"
              title="新建家庭账本"
              subtitle={user?.isVip ? '一家人各自记，汇到一起看，家人加入免费' : `${VIP_NAME}可建，先看看是什么样`}
              onPress={() => navigation.navigate('FamilyCreate')}
            />
            <ListRow glyph="red-packet" title="收到请帖？用邀请码加入" subtitle="加入别人的家庭账本，免费" onPress={() => navigation.navigate('Join', {})} />
          </Section>
        </>
      )}
    </Screen>
  )
}
