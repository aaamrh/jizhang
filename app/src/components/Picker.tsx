import { useState, type ReactNode } from 'react'
import { colors } from '../theme'
import { Icon } from './Icon'
import { Check } from './icons/ui'
import { ListRow } from './ListRow'
import { Sheet } from './Sheet'

export interface PickerOption {
  value: string
  label: string
  sub?: string
  /** 左侧的图（如切换账本时的小账簿） */
  leading?: ReactNode
}

interface Props {
  label: string
  value: string | null
  options: PickerOption[]
  onChange: (v: string) => void
  placeholder?: string
  /** 自定义触发控件（如记账页的胶囊）；默认是一行 ListRow */
  trigger?: (open: () => void, current: PickerOption | undefined) => ReactNode
}

/** 选择器：点开从底部弹出列表（钱袋、账本、成员等） */
export function Picker({ label, value, options, onChange, placeholder = '请选择', trigger }: Props) {
  const [open, setOpen] = useState(false)
  const cur = options.find((o) => o.value === value)
  return (
    <>
      {trigger ? trigger(() => setOpen(true), cur) : <ListRow title={label} value={cur?.label ?? placeholder} onPress={() => setOpen(true)} />}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {options.map((o) => (
          <ListRow
            key={o.value}
            leading={o.leading}
            title={o.label}
            subtitle={o.sub}
            chevron={false}
            value={o.value === value ? <Icon as={Check} color={colors.active} /> : undefined}
            onPress={() => {
              onChange(o.value)
              setOpen(false)
            }}
          />
        ))}
      </Sheet>
    </>
  )
}
