import { today } from '../utils/dates'
import { DateField } from './DateField'
import { Section } from './Section'
import { Txt } from './Txt'

/** 今年的不写年份（行里放不下“2026年11月20日（今天）”） */
const fullDay = (s: string) => {
  const t = today()
  const md = `${Number(s.slice(5, 7))}月${Number(s.slice(8, 10))}日`
  return `${s.slice(0, 4) === t.slice(0, 4) ? md : `${Number(s.slice(0, 4))}年${md}`}${s === t ? '（今天）' : ''}`
}

/**
 * 家庭账本的共享开始日期：新建、加入时各自选，这天起自己账本里的账汇进这个家庭。
 * 默认今天，不能选以后的日子；选早一点，以前记的账也汇进去
 */
export function ShareFromField({ value, onChange, ledgerName }: { value: string; onChange: (d: string) => void; ledgerName: string }) {
  return (
    <>
      <Section list title="共享开始日期">
        <DateField label="从哪天起" value={value} onChange={onChange} display={fullDay} noFuture />
      </Section>
      <Txt v="caption" muted>
        从这天起，你在自己账本里记的支出、收入和退款都会汇进「{ledgerName}」，这个家庭的人都能看到；转账不算。选早一点，以前记的账也会汇进去。
      </Txt>
    </>
  )
}
