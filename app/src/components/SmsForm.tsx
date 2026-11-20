import { useState } from 'react'
import { showAlert } from './dialogs'
import { View } from 'react-native'
import { useCountdown } from '../hooks/useCountdown'
import { space } from '../theme'
import { isPhone, isSmsCode } from '../utils/phone'
import { Button } from './Button'
import { TextField } from './TextField'

interface Props {
  submitTitle: string
  /** 发验证码，成功返回对象（测试环境带 devCode，会自动填上）；失败返回 undefined（调用方已提示） */
  onSend: (phone: string) => Promise<{ devCode?: string } | undefined>
  onSubmit: (phone: string, code: string) => void
  /** 发送前的检查（比如没勾选协议），返回 false 不发送 */
  beforeSend?: () => boolean
  busy?: boolean
}

/** 手机号 + 验证码（60 秒倒计时） */
export function SmsForm({ submitTitle, onSend, onSubmit, beforeSend, busy }: Props) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const { left, start } = useCountdown()

  const send = async () => {
    if (beforeSend && !beforeSend()) return
    if (!isPhone(phone)) return showAlert('提示', '请输入 11 位手机号')
    const r = await onSend(phone.trim())
    if (!r) return
    start()
    if (r.devCode) setCode(r.devCode)
  }
  const submit = () => {
    if (beforeSend && !beforeSend()) return
    if (!isPhone(phone)) return showAlert('提示', '请输入 11 位手机号')
    if (!isSmsCode(code)) return showAlert('提示', '请输入 6 位验证码')
    onSubmit(phone.trim(), code.trim())
  }

  return (
    <View style={{ gap: space.sm }}>
      <TextField value={phone} onChangeText={setPhone} placeholder="手机号" keyboardType="phone-pad" maxLength={11} accessibilityLabel="手机号" />
      <TextField
        value={code}
        onChangeText={setCode}
        placeholder="验证码"
        keyboardType="number-pad"
        maxLength={6}
        accessibilityLabel="验证码"
        suffix={<Button variant="ghost" size="sm" title={left > 0 ? `${left} 秒后重发` : '获取验证码'} disabled={left > 0} onPress={send} />}
      />
      <Button title={submitTitle} variant="primary" disabled={busy} onPress={submit} />
    </View>
  )
}
