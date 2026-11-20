import { useState } from 'react'
import { showAlert } from '../../components/dialogs'
import { Button } from '../../components/Button'
import { Picker } from '../../components/Picker'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Txt } from '../../components/Txt'
import { useCurrentLedger, useLedgers } from '../../hooks/data'
import { exportCurrentLedger, exportExcel, importIntoLedger } from '../../hooks/useBackup'
import { useAuth } from '../../store/authStore'
import { useUi } from '../../store/uiStore'
import { VIP_NAME } from '../../utils/copy'
import { useSettings } from '../../store/settingsStore'
import { dayLabel, toDateStr } from '../../utils/dates'

export default function BackupPage() {
  const ledgers = useLedgers()
  const current = useCurrentLedger()
  const lastExportAt = useSettings((s) => s.lastExportAt)
  const isVip = useAuth((s) => !!s.user?.isVip)
  const [target, setTarget] = useState(current?.id ?? '')

  const doImport = async () => {
    if (await importIntoLedger(target)) showAlert('导入完成', '账目已经恢复。')
  }

  return (
    <Screen>
      <Section title="导出">
        <Txt>把「{current?.name}」的全部数据存成一个文件，可以发到微信、网盘，或用隔空投送传到新手机。</Txt>
        <Txt v="small" muted>
          {lastExportAt ? `上次导出：${dayLabel(toDateStr(new Date(lastExportAt)))}` : '还没有导出过'}
        </Txt>
        <Button title="导出当前账本" variant="primary" onPress={exportCurrentLedger} />
      </Section>

      <Section title={`导出 Excel（${VIP_NAME}）`}>
        <Txt>把我的账本里的每一笔导成表格：日期、类型、分类、金额、钱袋、备注、复盘。用 Excel、WPS 打开，可以自己筛选、求和、做图。</Txt>
        <Button title="导出 Excel" onPress={() => (isVip ? void exportExcel() : useUi.getState().showVipSheet('excel'))} />
      </Section>

      {ledgers.length > 1 ? (
        <Section list title="导入到">
          <Picker label="导入到" value={target} options={ledgers.map((l) => ({ value: l.id, label: l.name }))} onChange={setTarget} />
        </Section>
      ) : null}
      <Section title="导入">
        <Txt>选择之前导出的文件，恢复到这个账本。导入会覆盖账本现有的全部数据。</Txt>
        <Button title="选择文件导入" variant="danger" onPress={doImport} />
      </Section>
    </Screen>
  )
}
