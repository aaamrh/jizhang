import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { confirm, confirmHold, showAlert } from '../../components/dialogs'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { SmsForm } from '../../components/SmsForm'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { accountActions, appleAvailable, sendSms, wechatAvailable } from '../../hooks/account'
import { syncNow } from '../../hooks/sync'
import { useAuth } from '../../store/authStore'
import type { Provider } from '../../types/api'
import type { StackProps } from '../../types/navigation'
import { dayLabel } from '../../utils/dates'
import { VIP_NAME } from '../../utils/copy'

const PROVIDER_LABEL: Record<Provider, string> = { wechat: '微信', phone: '手机号', apple: 'Apple' }

const vipDaysLeft = (until: string | null) => (until ? Math.max(0, Math.ceil((Date.parse(until) - Date.now()) / 86_400_000)) : 0)
const timeLabel = (t: number) => new Date(t).toTimeString().slice(0, 5)

export default function AccountPage({ navigation }: StackProps<'Account'>) {
  const { user, syncConsent, syncing, lastSyncAt, syncError } = useAuth()
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [bindingPhone, setBindingPhone] = useState(false)
  const [apple, setApple] = useState(false)

  useEffect(() => {
    appleAvailable().then(setApple)
  }, [])
  useEffect(() => {
    if (!user) navigation.goBack() // 退出、注销或 token 失效后离开这一页
  }, [user, navigation])
  if (!user) return null

  const bound = (p: Provider) => user.providers.includes(p)
  const providers: Provider[] = ['wechat', 'phone', ...(apple || bound('apple') ? (['apple'] as const) : [])]

  const toggle = async (p: Provider) => {
    if (bound(p)) {
      if (await confirm(`解绑${PROVIDER_LABEL[p]}？`, '解绑后不能再用它登录这个账号。', '解绑', true)) await accountActions.unbind(p)
    } else if (p === 'phone') setBindingPhone(true)
    else if (p === 'wechat' && !wechatAvailable()) showAlert('提示', '当前环境不支持微信登录')
    else await accountActions.bind(p)
  }

  const logout = async () => {
    if (await confirm('退出登录？', '这台手机上的家庭账本会被移除（云端还在），个人账本保留在本机。', '退出')) {
      await accountActions.logout()
    }
  }

  const remove = async () => {
    const days = vipDaysLeft(user.vipUntil)
    // 回不去：按住才生效（代替原来的两次确认）
    const vip = days > 0 ? `\n${VIP_NAME}还剩 ${days} 天，注销后作废，不退款。` : ''
    const msg = `服务器上的账号和同步的账目会全部删除，不能恢复；这台手机上的个人账本会保留。${vip}\n你建的家庭账本会转给其他成员，没有其他成员的会被删除。`
    if (!(await confirmHold('注销账号？', msg, '按住注销'))) return
    await accountActions.deleteAccount()
  }

  const syncText = syncing ? '正在同步…' : syncError ? `上次同步失败：${syncError}` : lastSyncAt ? `已同步 · ${timeLabel(lastSyncAt)}` : '已开启'

  return (
    <Screen>
      <TextField
        label="昵称"
        value={nickname}
        onChangeText={setNickname}
        maxLength={20}
        accessibilityLabel="昵称"
        suffix={
          <Button
            title="保存"
            variant="ghost"
            size="sm"
            disabled={!nickname.trim() || nickname === user.nickname}
            onPress={() => accountActions.rename(nickname.trim())}
          />
        }
      />

      <Section list title="登录方式（至少保留一种）">
        {providers.map((p) => (
          <ListRow
            key={p}
            title={PROVIDER_LABEL[p]}
            subtitle={p === 'phone' && user.phone ? user.phone : bound(p) ? '已绑定' : '未绑定'}
            value={bound(p) ? '解绑' : '绑定'}
            onPress={() => toggle(p)}
          />
        ))}
      </Section>
      {bindingPhone && !bound('phone') ? (
        <Section title="绑定手机号" plain>
          <SmsForm
            submitTitle="绑定手机号"
            onSend={sendSms}
            onSubmit={async (phone, code) => {
              if (await accountActions.bind('phone', { phone, code })) setBindingPhone(false)
            }}
          />
        </Section>
      ) : null}

      {syncConsent ? (
        <Section list title="云同步：账目加密传输，换手机登录即可恢复">
          <ListRow title="同步状态" subtitle={syncText} value="立即同步" onPress={() => void syncNow()} />
        </Section>
      ) : (
        <Section title="云同步">
          <Txt>没有开启。账目只在这台手机上，家庭账本也用不了。</Txt>
          <Button title="开启云同步" variant="primary" onPress={() => void accountActions.turnOnSync()} />
        </Section>
      )}

      <Section list>
        <ListRow title="退出登录" onPress={logout} />
        <ListRow title="注销账号" danger chevron={false} onPress={remove} />
      </Section>
      <Txt v="caption" faint center>
        注册于 {dayLabel(user.createdAt.slice(0, 10))}
      </Txt>
    </Screen>
  )
}
