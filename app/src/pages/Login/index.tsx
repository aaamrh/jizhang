import { useEffect, useState } from 'react'
import { showAlert } from '../../components/dialogs'
import { Pressable, View } from 'react-native'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Check } from '../../components/icons/ui'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Seal } from '../../components/Seal'
import { SmsForm } from '../../components/SmsForm'
import { Txt } from '../../components/Txt'
import { appleAvailable, loginWith, onekeyAvailable, sendSms, wechatAvailable } from '../../hooks/account'
import { colors, hairline, radius, size, space } from '../../theme'
import type { StackProps } from '../../types/navigation'

export default function LoginPage({ navigation }: StackProps<'Login'>) {
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [apple, setApple] = useState(false)
  const wechat = wechatAvailable()

  useEffect(() => {
    appleAvailable().then(setApple)
  }, [])

  const checkAgree = () => {
    if (!agreed) showAlert('提示', '请先阅读并同意《用户协议》和《隐私政策》')
    return agreed
  }
  const run = async (fn: () => Promise<boolean>) => {
    if (!checkAgree() || busy) return
    setBusy(true)
    const ok = await fn()
    setBusy(false)
    if (ok) navigation.goBack()
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.md }}>
        <Seal char="账" px={size.sealLg} filled />
        <Txt v="title" center>
          换手机不丢账，还能和家人一起记
        </Txt>
        <Txt v="small" muted center>
          不登录也能正常记账，账目只留在这台手机上
        </Txt>
      </View>

      <View style={{ gap: space.sm }}>
        {wechat ? (
          <Button title="微信登录" variant="primary" disabled={busy} onPress={() => run(() => loginWith('wechat'))} />
        ) : (
          <Txt v="small" muted center>
            当前环境不支持微信登录，请用手机号登录
          </Txt>
        )}
        {apple ? <Button title="通过 Apple 登录" disabled={busy} onPress={() => run(() => loginWith('apple'))} /> : null}
        {/* 本机号码一键登录：接入运营商 SDK 后在 api/nativeLogin 打开 */}
        {onekeyAvailable() ? <Button title="本机号码一键登录" disabled={busy} onPress={() => {}} /> : null}
      </View>

      <Section title="手机号登录" plain>
        <SmsForm
          submitTitle="登录"
          busy={busy}
          beforeSend={checkAgree}
          onSend={sendSms}
          onSubmit={(phone, code) => run(() => loginWith('sms', { phone, code }))}
        />
      </Section>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        onPress={() => setAgreed(!agreed)}
        style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' }}
      >
        <View
          style={{
            width: space.lg,
            height: space.lg,
            borderRadius: radius.pill,
            borderWidth: hairline * 3,
            borderColor: agreed ? colors.active : colors.ink3,
            backgroundColor: agreed ? colors.active : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {agreed ? <Icon as={Check} size="inline" color={colors.white} /> : null}
        </View>
        <Txt v="small" muted style={{ flex: 1 }}>
          我已阅读并同意
          <Txt v="small" color={colors.seal} onPress={() => navigation.navigate('Legal', { kind: 'terms' })}>
            《用户协议》
          </Txt>
          和
          <Txt v="small" color={colors.seal} onPress={() => navigation.navigate('Legal', { kind: 'privacy' })}>
            《隐私政策》
          </Txt>
        </Txt>
      </Pressable>
    </Screen>
  )
}
