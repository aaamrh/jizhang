import { Pressable, type DimensionValue } from 'react-native'
import { useCurrentLedger, useFamilies } from '../hooks/data'
import { useSettings } from '../store/settingsStore'
import { colors, space } from '../theme'
import { LEDGER_TYPE_LABEL } from '../types/domain'
import { LedgerCoverSlot } from './BookCover'
import { Icon } from './Icon'
import { ChevronDown } from './icons/ui'
import { Picker } from './Picker'
import { Txt } from './Txt'

const MANAGE = '__manage'

/**
 * 账本切换：页面顶部居中「账本名 ▾」，一眼能看出可以点（参照鲨鱼记账）；最后一项进账本管理。
 * 流水、盘账共用，两页切的是同一个（settingsStore 的 familyView）。
 * maxWidth：账本名太长时省略；顶栏右侧放了东西多的页面（盘账的周月年）要收窄，免得叠上
 */
export function LedgerSwitch({ onManage, maxWidth = '70%' }: { onManage: () => void; maxWidth?: DimensionValue }) {
  const ledger = useCurrentLedger() // 我的账本：本机数据、记账都用它
  const { families, viewed: family } = useFamilies()
  const setFamilyView = useSettings((st) => st.setFamilyView)
  const current = family ?? ledger
  return (
    <Picker
      label="切换账本"
      value={current?.id ?? null}
      options={[
        ...[ledger, ...families].filter((l) => !!l).map((l) => ({ value: l.id, label: l.name, sub: LEDGER_TYPE_LABEL[l.type], leading: <LedgerCoverSlot ledger={l} /> })),
        { value: MANAGE, label: '管理账本…', leading: <LedgerCoverSlot /> },
      ]}
      onChange={(v) => (v === MANAGE ? onManage() : setFamilyView(v === ledger?.id ? '' : v))}
      trigger={(open) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`当前账本：${current?.name ?? '账本'}，点按切换`}
          hitSlop={space.xs}
          onPress={open}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.xxs, maxWidth }, pressed && { opacity: 0.6 }]}
        >
          <Txt v="h2" medium numberOfLines={1}>
            {current?.name ?? '我的账本'}
          </Txt>
          <Icon as={ChevronDown} size="inline" color={colors.ink} />
        </Pressable>
      )}
    />
  )
}
