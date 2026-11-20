import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { useMemo } from 'react'
import { View } from 'react-native'
import { useCurrentLedger, useEntries, useMembers } from '../hooks/data'
import { colors, space } from '../theme'
import type { RootParams } from '../types/navigation'
import { whoLabel } from '../utils/members'
import { formatYuan } from '../utils/money'
import type { Necessity } from '../utils/necessity'
import { NECESSITY_LABEL } from '../utils/necessity'
import { Sheet } from './Sheet'
import { Txt } from './Txt'
import { TxnRow } from './TxnItem'

export interface EntriesTarget {
  /** 标题前半：分类名、“非必要”、“11 月” 等 */
  label: string
  /** 区间说明：本周、2026 年、11 月 */
  period: string
  start: string
  end: string // 不含
  categoryId: string | null
  necessity: Necessity | 'all'
  excludeAssets?: boolean
}

/**
 * 统一的“点开看每一笔”面板：周账、年账、盘账里点分类、点必要性、点月份柱子都用它。
 * 半屏打开，上拉全屏；每行可左滑删除、长按出菜单、点开编辑
 */
export function EntriesSheet({ target, onClose }: { target: EntriesTarget | null; onClose: () => void }) {
  const navigation = useNavigation<NavigationProp<RootParams>>()
  const q = useMemo(
    () =>
      target
        ? { start: target.start, end: target.end, categoryId: target.categoryId, necessity: target.necessity, excludeAssets: target.excludeAssets }
        : null,
    [target],
  )
  const list = useEntries(q)
  const members = useMembers()
  const family = useCurrentLedger()?.type === 'family'
  const total = list.reduce((a, t) => a + (t.type === 'refund' ? -t.amountCents : t.amountCents), 0)
  const label = target ? (target.categoryId && target.necessity !== 'all' ? `${target.label} · ${NECESSITY_LABEL[target.necessity]}` : target.label) : ''
  const title = target ? `${label} · ${target.period} ${formatYuan(total)} · ${list.length} 笔` : ''
  // 点开编辑前先收起面板，回来时不挡视线
  const nav = {
    navigate: ((...args: Parameters<typeof navigation.navigate>) => {
      onClose()
      navigation.navigate(...args)
    }) as typeof navigation.navigate,
  }

  return (
    <Sheet visible={!!target} onClose={onClose} title={title} expandable>
      {list.length === 0 ? (
        <Txt muted center style={{ paddingVertical: space.xxl }}>
          这段时间没有这样的账
        </Txt>
      ) : (
        <View style={{ backgroundColor: colors.surface }}>
          {list.map((t) => (
            <TxnRow key={t.id} t={t} who={family ? whoLabel(t, members) : undefined} navigation={nav} />
          ))}
        </View>
      )}
    </Sheet>
  )
}
