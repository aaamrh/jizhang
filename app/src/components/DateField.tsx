import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import { colors, space } from '../theme'
import { fromDateStr, toDateStr } from '../utils/dates'
import { Button } from './Button'
import { DatePickerSheet } from './DatePicker'
import { ListRow } from './ListRow'
import { Sheet } from './Sheet'

const pad = (n: number) => String(n).padStart(2, '0')

type Mode = 'date' | 'time'

function toDate(mode: Mode, v: string) {
  if (mode === 'date') return fromDateStr(v)
  const [h, m] = v.split(':').map(Number)
  const d = new Date()
  d.setHours(h ?? 21, m ?? 0, 0, 0)
  return d
}

const fromDate = (mode: Mode, d: Date) => (mode === 'date' ? toDateStr(d) : `${pad(d.getHours())}:${pad(d.getMinutes())}`)

interface Props {
  label: string
  mode?: Mode
  /** date 模式为 'YYYY-MM-DD'，time 模式为 'HH:MM' */
  value: string
  onChange: (v: string) => void
  display?: (v: string) => string
  /** 自定义触发控件（如记账键盘上的日期键）；默认是一行 ListRow */
  trigger?: (open: () => void) => ReactNode
  /** 不能选未来的日期 */
  noFuture?: boolean
  /** 日历上面的内容（见 DatePickerSheet） */
  header?: ReactNode
}

/**
 * 日期 / 时间选择。
 * 日期：统一用自绘的月历面板（可点标题快速跳年、跳月，一键回到今天）；
 * 时间：安卓弹系统对话框，iOS 在底部面板里用原生滚轮。
 */
export function DateField({ label, mode = 'date', value, onChange, display, trigger, noFuture, header }: Props) {
  const [iosOpen, setIosOpen] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const open = () => {
    if (mode === 'date') setCalOpen(true)
    else if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: toDate(mode, value), mode, is24Hour: true, onValueChange: (_e, d) => onChange(fromDate(mode, d)) })
    } else {
      setDraft(value)
      setIosOpen(true)
    }
  }
  return (
    <>
      {trigger ? trigger(open) : <ListRow title={label} value={display ? display(value) : value} onPress={open} />}
      {mode === 'date' ? (
        <DatePickerSheet visible={calOpen} onClose={() => setCalOpen(false)} kind="day" value={value} onChange={onChange} noFuture={noFuture} header={header} />
      ) : null}
      {mode === 'time' && Platform.OS === 'ios' ? (
        <Sheet visible={iosOpen} onClose={() => setIosOpen(false)} title={label} scroll={false}>
          <DateTimePicker
            value={toDate(mode, draft)}
            mode={mode}
            display="spinner"
            locale="zh-CN"
            accentColor={colors.active}
            themeVariant="light"
            onValueChange={(_e, d) => setDraft(fromDate(mode, d))}
          />
          <Button
            title="确定"
            variant="primary"
            style={{ marginHorizontal: space.lg }}
            onPress={() => {
              onChange(draft)
              setIosOpen(false)
            }}
          />
        </Sheet>
      ) : null}
    </>
  )
}
