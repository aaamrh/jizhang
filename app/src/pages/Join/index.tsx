import { useCallback, useEffect, useRef, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { Button } from '../../components/Button'
import { InviteCard } from '../../components/InviteCard'
import { Screen } from '../../components/Screen'
import { ShareFromField } from '../../components/ShareFromField'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { accountActions } from '../../hooks/account'
import { familyActions } from '../../hooks/family'
import { useAuth } from '../../store/authStore'
import { useUi } from '../../store/uiStore'
import { GUTTER, size, space } from '../../theme'
import type { InvitePreview } from '../../types/api'
import type { StackProps } from '../../types/navigation'
import { today } from '../../utils/dates'
import { ledgerCover } from '../../utils/ledgerCover'

const CODE_LEN = 8
const md = (iso: string) => `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日`

/**
 * 加入家庭账本：输入邀请码（或点邀请链接直接打开）→ 看请帖 → 选自己的账从哪天起共享 → 没登录先登录
 * （登录完回到这里自动接着加入）→ 同意云同步 → 加入 → 欢迎提示，切到这个账本。可以同时在好几个家庭里。
 */
export default function JoinPage({ navigation, route }: StackProps<'Join'>) {
  const { user, syncConsent } = useAuth()
  const { width } = useWindowDimensions()
  const [code, setCode] = useState(route.params?.code?.toUpperCase() ?? '')
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shareFrom, setShareFrom] = useState(today())
  // 点了“登录后加入”：登录回来后自动继续
  const resume = useRef(false)

  const look = useCallback(async (c: string) => {
    setError('')
    setPreview(null)
    try {
      setPreview(await familyActions.preview(c))
    } catch (e: any) {
      setError(e?.message ?? '邀请码不对')
    }
  }, [])

  // 从邀请链接打开时直接查
  useEffect(() => {
    if (route.params?.code) void look(route.params.code)
  }, [route.params?.code, look])

  const join = useCallback(async () => {
    if (!preview || busy) return
    setBusy(true)
    const l = await familyActions.join(code, shareFrom)
    setBusy(false)
    if (l) {
      useUi.getState().showToast(`欢迎加入「${l.name}」，以后在这里一起记账`)
      navigation.navigate('Tabs', { screen: 'Home' })
    }
  }, [preview, busy, code, shareFrom, navigation])

  // 登录回来：已经同意过云同步就直接加入；还没同意的，等用户点“同意并加入”
  useEffect(() => {
    if (resume.current && user && syncConsent && preview) {
      resume.current = false
      void join()
    }
  }, [user, syncConsent, preview, join])

  const agreeAndJoin = async () => {
    await accountActions.turnOnSync(true)
    if (useAuth.getState().syncConsent) await join()
  }

  const cardW = Math.min(width - GUTTER * 2, size.inviteCard)
  return (
    <Screen>
      <TextField
        label="邀请码"
        value={code}
        onChangeText={(t) => {
          const c = t.toUpperCase().replace(/[^0-9A-Z]/g, '')
          setCode(c)
          if (c.length === CODE_LEN) void look(c) // 输满 8 位自动查
        }}
        placeholder="家人发来的 8 位邀请码"
        autoCapitalize="characters"
        maxLength={CODE_LEN}
        error={error || null}
        suffix={<Button title="查看" variant="ghost" size="sm" disabled={code.length !== CODE_LEN} onPress={() => look(code)} />}
      />

      {preview ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <InviteCard
              width={cardW}
              ledgerName={preview.ledgerName}
              cover={ledgerCover({ type: 'family', cover: preview.cover ?? null })}
              inviter={preview.inviterNickname}
              profile={preview.profileNickname}
              code={code}
              expires={md(preview.expiresAt)}
            />
          </View>
          <Txt v="small" muted>
            已有 {preview.memberCount} 位成员。
            {preview.profileNickname ? `你会以「${preview.profileNickname}」的身份加入，记在这个名字下的账都归你。` : ''}
          </Txt>
          <ShareFromField value={shareFrom} onChange={setShareFrom} ledgerName={preview.ledgerName} />
          {!user ? (
            <Button
              title="登录后加入"
              variant="primary"
              onPress={() => {
                resume.current = true
                navigation.navigate('Login')
              }}
            />
          ) : !syncConsent ? (
            <>
              <Button title="同意云同步，并加入" variant="primary" disabled={busy} onPress={agreeAndJoin} />
              <Txt v="caption" muted center>
                家庭账本的账目要通过服务器在家人之间同步
              </Txt>
            </>
          ) : (
            <Button title={`加入「${preview.ledgerName}」`} variant="primary" disabled={busy} onPress={join} />
          )}
        </>
      ) : (
        <Txt v="small" muted>
          打开家人发来的请帖链接会自动填好；也可以让家人把邀请码念给你。
        </Txt>
      )}
    </Screen>
  )
}
