import * as Clipboard from 'expo-clipboard'
import * as Sharing from 'expo-sharing'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Share, useWindowDimensions, View } from 'react-native'
import ViewShot, { type ViewShotRef } from 'react-native-view-shot'
import { Button } from '../../components/Button'
import { confirm } from '../../components/dialogs'
import { InviteCard } from '../../components/InviteCard'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { useLedgers } from '../../hooks/data'
import { familyActions } from '../../hooks/family'
import { useAuth } from '../../store/authStore'
import { useUi } from '../../store/uiStore'
import { GUTTER, size, space } from '../../theme'
import type { Invite } from '../../types/api'
import type { StackProps } from '../../types/navigation'
import { ledgerCover } from '../../utils/ledgerCover'

/** 'YYYY-MM-DD…' → 'M月D日' */
const md = (iso: string) => `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日`

/**
 * 邀请家人：生成请帖 → 把请帖图片发到微信，或发文字链接、复制邀请码。
 * 请帖 7 天有效，可多人使用，直到满员；可以随时作废。
 */
export default function InvitePage({ navigation, route }: StackProps<'Invite'>) {
  const { ledgerId } = route.params
  const ledger = useLedgers().find((l) => l.id === ledgerId)
  const me = useAuth((s) => s.user)
  const { width } = useWindowDimensions()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [active, setActive] = useState<Invite[]>([])
  const [busy, setBusy] = useState(false)
  const shot = useRef<ViewShotRef>(null)

  const reload = useCallback(() => {
    familyActions.listInvites(ledgerId).then(setActive).catch(() => {})
  }, [ledgerId])
  useEffect(reload, [reload])


  const create = async () => {
    if (busy) return
    setBusy(true)
    const inv = await familyActions.createInvite(ledgerId)
    setBusy(false)
    if (inv === undefined) {
      if (!useAuth.getState().user?.isVip) useUi.getState().showVipSheet('family') // 到期后不能发新请帖
      return
    }
    setInvite(inv)
    reload()
  }

  const text = (inv: Invite) =>
    `${me?.nickname ?? '家人'}邀请你加入家庭账本「${ledger?.name ?? ''}」，一起记账。\n打开链接：${inv.url}\n或在账房里输入邀请码：${inv.code}（${md(inv.expiresAt)}前有效）`

  /** 把请帖截成图片，用系统分享发出去（微信里能直接看到请帖） */
  const shareImage = async (inv: Invite) => {
    try {
      const uri = await shot.current?.capture?.()
      if (!uri || !(await Sharing.isAvailableAsync())) throw new Error('no share')
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '把请帖发给家人' })
    } catch {
      void Share.share({ message: text(inv) }) // 截图或分享不可用时退回发文字
    }
  }

  const copy = async (inv: Invite) => {
    await Clipboard.setStringAsync(inv.code)
    useUi.getState().showToast(`邀请码 ${inv.code} 已复制`)
  }

  const revoke = async (inv: Invite) => {
    if (!(await confirm(`作废邀请码 ${inv.code}？`, '作废后，还没加入的人用这个请帖就进不来了；已经加入的不受影响。', '作废', true))) return
    if (await familyActions.revokeInvite(ledgerId, inv.code)) {
      if (invite?.code === inv.code) setInvite(null)
      reload()
    }
  }

  const cardW = Math.min(width - GUTTER * 2, size.inviteCard)
  return (
    <Screen>
      <Button title={invite ? '再生成一张' : '写请帖'} variant={invite ? 'secondary' : 'primary'} disabled={busy} onPress={create} />

      {invite ? (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <ViewShot ref={shot} options={{ format: 'png', quality: 1, fileName: `请帖-${invite.code}` }}>
            <InviteCard
              width={cardW}
              ledgerName={ledger?.name ?? ''}
              cover={ledgerCover({ type: 'family', cover: ledger?.cover ?? null })}
              inviter={me?.nickname ?? '家人'}
              code={invite.code}
              qrValue={invite.url}
              expires={md(invite.expiresAt)}
            />
          </ViewShot>
          <View style={{ alignSelf: 'stretch', gap: space.xs }}>
            <Button title="把请帖发给家人" variant="primary" onPress={() => shareImage(invite)} />
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              <Button title="发文字链接" size="md" style={{ flex: 1 }} onPress={() => void Share.share({ message: text(invite) })} />
              <Button title="复制邀请码" size="md" style={{ flex: 1 }} onPress={() => copy(invite)} />
            </View>
          </View>
        </View>
      ) : null}

      {active.length > 0 ? (
        <Section list title="发出去的请帖">
          {active.map((inv) => (
            <ListRow
              key={inv.code}
              glyph="red-packet"
              title={inv.code}
              subtitle={`${md(inv.expiresAt)}前有效`}
              value="作废"
              onPress={() => revoke(inv)}
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  )
}
