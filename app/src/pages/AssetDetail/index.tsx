import { useState } from 'react'
import { View } from 'react-native'
import { AssetCover } from '../../components/AssetCard'
import { Button } from '../../components/Button'
import { Chip, Segmented } from '../../components/Chip'
import { PressScale } from '../../components/motion'
import { Picker } from '../../components/Picker'
import { DateField } from '../../components/DateField'
import { attempt, confirm } from '../../components/dialogs'
import { Plus } from '../../components/icons/ui'
import { ListRow } from '../../components/ListRow'
import { Stat } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TextField } from '../../components/TextField'
import { Txt } from '../../components/Txt'
import { assetActions } from '../../hooks/actions'
import { useAsset, useWallet } from '../../hooks/data'
import { choosePhoto, forgetPhoto, photoNote, removePhoto, usePhoto } from '../../hooks/photo'
import { useAuth } from '../../store/authStore'
import { colors, incomeColor, space } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { assetCost, perDayAfter } from '../../utils/assetCost'
import { dayLabel, today } from '../../utils/dates'
import { formatPlain, formatYuan } from '../../utils/money'

const ENDED = { sold: '已卖出', lost: '已丢失', broken: '已损坏' } as const

const NO_PHOTO = { photo: null, photoFileId: null, photoCachedFor: null }

export default function AssetDetailPage({ navigation, route }: StackProps<'AssetDetail'>) {
  const a = useAsset(route.params.id)
  const soldTo = useWallet(a?.soldWalletId ?? undefined)
  const [endDate, setEndDate] = useState(today())
  const [countText, setCountText] = useState<string | null>(null)
  const photo = usePhoto('assets', route.params.id, a ?? NO_PHOTO)
  const loggedIn = useAuth((s) => !!s.token)

  if (!a)
    return (
      <Screen>
        <Txt muted>这件家当已经不存在了</Txt>
      </Screen>
    )
  const c = assetCost(a, today())
  const holding = a.status === 'holding'

  const end = async (status: 'lost' | 'broken') => {
    const label = status === 'lost' ? '丢失' : '损坏'
    if (await confirm(`标记为${label}？`, `日期：${endDate}。不会动任何钱袋，之后可以撤销。`, '确定')) attempt(() => assetActions.end(a.id, status, endDate))
  }
  const undo = async () => {
    const msg = a.status === 'sold' ? '会删掉卖出时生成的那笔收入，恢复成持有中。' : '恢复成持有中。'
    if (await confirm('撤销？', msg)) attempt(() => assetActions.undo(a.id))
  }
  const remove = async () => {
    const msg = a.fromTxn ? '买它的那笔支出会保留，只是不再算作家当。' : '删除后不能恢复。'
    if ((await confirm(`删除「${a.name}」？`, msg, '删除', true)) && attempt(() => assetActions.remove(a.id))) {
      forgetPhoto(a.photo, a.photoFileId) // 照片一起删（手机上和服务器上）
      navigation.goBack()
    }
  }
  const saveCount = () => {
    const n = Number(countText)
    if (countText !== null && /^\d+$/.test(countText) && attempt(() => assetActions.setUseCount(a.id, n))) setCountText(null)
  }

  const byUse = a.costMode === 'use'
  const hasPhoto = photo.state.kind !== 'none'
  const photoOptions = [
    { value: 'camera', label: '拍照' },
    { value: 'library', label: '从相册选' },
    ...(hasPhoto ? [{ value: 'remove', label: '删除照片' }] : []),
  ]

  return (
    <Screen>
      {/* 封面：点一下拍照或从相册选；登录同步后照片上云 */}
      <Picker
        label={hasPhoto ? '更换照片' : '添加照片'}
        value={null}
        options={photoOptions}
        onChange={(v) => (v === 'remove' ? removePhoto(a.id, a.photo) : void choosePhoto(a.id, a.photo, v as 'camera' | 'library'))}
        trigger={(open) => (
          <PressScale accessibilityRole="button" accessibilityLabel={hasPhoto ? '更换照片' : '添加照片'} onPress={open} scaleTo={0.98}>
            <AssetCover a={a} rounded="all" />
            <View style={{ position: 'absolute', right: space.sm, bottom: space.sm }}>
              <Chip glyph="scroll" label={hasPhoto ? '换照片' : '加照片'} onPress={open} />
            </View>
          </PressScale>
        )}
      />
      <Txt v="caption" faint center style={{ marginTop: -space.md }}>
        {photoNote(photo.state, loggedIn)}
      </Txt>

      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Txt v="title" style={{ flex: 1 }} numberOfLines={2}>
            {a.name}
          </Txt>
          <Button title="编辑" variant="ghost" size="sm" onPress={() => navigation.navigate('AssetForm', { id: a.id })} />
        </View>
        <Txt v="small" muted>
          {dayLabel(a.acquiredOn)}买入 · {formatYuan(a.costCents)}
          {holding ? '' : ` · ${dayLabel(a.endedOn!)}${ENDED[a.status as keyof typeof ENDED]}`}
        </Txt>
        {a.note ? <Txt v="small">{a.note}</Txt> : null}
      </View>

      <Section>
        <View style={{ flexDirection: 'row' }}>
          {byUse ? (
            <>
              <Stat value={`${a.useCount}`} label="用了（次）" />
              <Stat value={c.perUseCents === null ? '—' : formatPlain(c.perUseCents)} label="每次" v="title" color={colors.seal} />
              <Stat value={`${c.days}`} label={holding ? '已持有（天）' : '共持有（天）'} />
            </>
          ) : (
            <>
              <Stat value={`${c.days}`} label={holding ? '已持有（天）' : '共持有（天）'} />
              <Stat value={formatPlain(c.perDayCents)} label="日均" v="title" color={colors.seal} />
              <Stat value={c.perUseCents === null ? '—' : formatPlain(c.perUseCents)} label="每次" />
            </>
          )}
        </View>
        {holding && !byUse ? (
          <Txt v="small" color={colors.green} center>
            再用 180 天，日均降到 {formatYuan(perDayAfter(c, 180))}
          </Txt>
        ) : null}
        {a.status === 'sold' ? (
          <Txt v="small" color={c.profitCents! >= 0 ? incomeColor : colors.ink2} center>
            卖了 {formatYuan(a.soldCents!)}
            {soldTo ? `，进了「${soldTo.name}」` : ''}，{c.profitCents! >= 0 ? `赚了 ${formatYuan(c.profitCents!)}` : `实际花了 ${formatYuan(c.netCents)}`}
          </Txt>
        ) : null}
      </Section>

      <Section title="怎么算值不值">
        <Segmented
          options={[
            { value: 'day', label: '按天（默认）' },
            { value: 'use', label: '按次' },
          ]}
          value={a.costMode}
          onChange={(m) => attempt(() => assetActions.setCostMode(a.id, m))}
        />
        <Txt v="small" muted>
          {byUse ? '偶尔才用的东西（相机、帐篷、礼服）按次算更准：每用一次点一下「用了一次」。' : '手机、电脑这类天天用的，按天算更准：持有越久，每天花得越少。'}
        </Txt>
      </Section>

      {byUse ? (
      <Section title="使用次数">
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <TextField
              value={countText ?? String(a.useCount)}
              onChangeText={setCountText}
              onBlur={saveCount}
              onSubmitEditing={saveCount}
              keyboardType="number-pad"
              suffix="次"
              accessibilityLabel="使用次数"
            />
          </View>
          <Button title="用了一次" icon={Plus} variant="primary" onPress={() => attempt(() => assetActions.addUse(a.id))} />
        </View>
      </Section>
      ) : null}

      {holding ? (
        <Section list title="出手">
          <ListRow title="卖出" subtitle="自动记一笔「变卖」收入" onPress={() => navigation.navigate('AssetSell', { id: a.id })} />
          <DateField label="丢失 / 损坏日期" value={endDate} onChange={setEndDate} />
          <ListRow title="丢失了" onPress={() => end('lost')} />
          <ListRow title="坏了" onPress={() => end('broken')} />
          <ListRow title="删除" danger chevron={false} onPress={remove} />
        </Section>
      ) : (
        <Section list>
          <ListRow title="撤销，恢复成持有中" onPress={undo} />
        </Section>
      )}
    </Screen>
  )
}
