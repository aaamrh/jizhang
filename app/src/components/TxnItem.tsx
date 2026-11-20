import type { NavigationProp } from '@react-navigation/native'
import { colors, expenseColor, iconSize, incomeColor, space } from '../theme'
import type { TxnView } from '../types/domain'
import { formatPlain } from '../utils/money'
import { View } from 'react-native'
import { CategoryIcon } from './CategoryIcon'
import { Chip } from './Chip'
import { FeatureIcon } from './Icon'
import { ListRow } from './ListRow'
import { RetroGlyph } from './RetroGlyph'
import { deleteTxnFlow, openTxnMenu } from '../hooks/actions'
import type { RootParams } from '../types/navigation'
import { SwipeRow } from './SwipeRow'
import { Txt } from './Txt'

const REVIEW_LABEL = { necessary: '必要', unnecessary: '非必要' } as const

function title(t: TxnView) {
  if (t.note.trim()) return t.note.trim()
  if (t.type === 'transfer') return `${t.walletName} → ${t.toWalletName ?? '已删除的钱袋'}`
  const name = t.categoryName ?? '未分类'
  return t.type === 'refund' ? `${name}退款` : name
}

/** 账目列表的一行：标题是备注（没有就用分类名），副标题是分类 · 钱袋（家庭账本里再加上是谁记的） */
/** 标签：最多露两个，多的写 +1；点了看这个标签的所有账（onTag） */
function TagChips({ tags, onTag }: { tags: string[]; onTag?: (name: string) => void }) {
  if (!tags.length) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs, flexShrink: 0 }}>
      {tags.slice(0, 2).map((name) => (
        <Chip key={name} small label={name} onPress={onTag ? () => onTag(name) : undefined} />
      ))}
      {tags.length > 2 ? (
        <Txt v="caption" faint>
          +{tags.length - 2}
        </Txt>
      ) : null}
    </View>
  )
}

export function TxnItem({
  t,
  onPress,
  onLongPress,
  who,
  onTag,
}: {
  t: TxnView
  onPress?: () => void
  onLongPress?: () => void
  who?: string
  onTag?: (name: string) => void
}) {
  const sign = t.type === 'expense' ? '-' : t.type === 'transfer' ? '' : '+'
  const review = t.review ? REVIEW_LABEL[t.review] : ''
  const parts = [
    t.note.trim() ? (t.type === 'transfer' ? '转账' : t.categoryName) : null,
    t.type === 'transfer' ? (t.note.trim() ? `${t.walletName} → ${t.toWalletName ?? '已删除的钱袋'}` : '转账') : t.walletName,
    who,
    t.assetId ? '家当' : null,
    review ? `细算：${review}` : null,
  ]
  return (
    <ListRow
      title={title(t)}
      titleExtra={
        t.tags?.length || t.photo || t.photoFileId || t.recurringId ? (
          <>
            {t.recurringId ? <RetroGlyph name="cycle" color={colors.ink2} px={iconSize.inline} /> : null}
            {t.photo || t.photoFileId ? <RetroGlyph name="camera" color={colors.ink2} px={iconSize.inline} /> : null}
            {t.tags?.length ? <TagChips tags={t.tags} onTag={onTag} /> : null}
          </>
        ) : undefined
      }
      subtitle={parts.filter(Boolean).join(' · ')}
      chevron={false}
      onPress={onPress}
      onLongPress={onLongPress}
      leading={
        t.categoryIcon ? (
          <CategoryIcon icon={t.categoryIcon} color={t.categoryColor} />
        ) : (
          <FeatureIcon name="pouch" color={colors.ink2} />
        )
      }
      value={
        <Txt serif color={t.type === 'transfer' ? colors.ink2 : t.type === 'expense' ? expenseColor : incomeColor}>
          {sign}
          {formatPlain(t.amountCents)}
        </Txt>
      }
    />
  )
}

/** 列表里能操作的账目：点开编辑，左滑删除，长按出菜单（编辑 / 再记一笔 / 存为常记 / 设为周期记账 / 删除） */
export function TxnRow({ t, who, navigation }: { t: TxnView; who?: string; navigation: Pick<NavigationProp<RootParams>, 'navigate'> }) {
  const edit = () => navigation.navigate('EntryEdit', { id: t.id })
  return (
    <SwipeRow onDelete={() => void deleteTxnFlow(t)}>
      <TxnItem
        t={t}
        who={who}
        onPress={edit}
        onTag={(name) => navigation.navigate('Tag', { name })}
        onLongPress={() =>
          openTxnMenu(t, {
            edit,
            copy: () => navigation.navigate('EntryEdit', { copyFrom: t.id }),
            toTemplate: () => navigation.navigate('TemplateForm', { fromTxn: t.id }),
            toRecurring: () => navigation.navigate('RecurringForm', { fromTxn: t.id }),
          })
        }
      />
    </SwipeRow>
  )
}
