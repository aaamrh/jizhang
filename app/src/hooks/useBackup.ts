import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { exportLedger, importLedger, parseBackup } from '../db/backup'
import { db } from '../db/client'
import { getLedger } from '../db/ledgerRepo'
import { confirmHold, showError } from '../components/dialogs'
import { useSettings } from '../store/settingsStore'
import { today } from '../utils/dates'
import { EXCEL_WIDTHS, excelRows } from '../utils/excelRows'
import { buildXlsx } from '../utils/xlsx'

/** 导出当前账本为 JSON，用系统分享发出去 */
export async function exportCurrentLedger() {
  try {
    const id = useSettings.getState().currentLedgerId
    const data = exportLedger(db, id)
    const file = new File(Paths.cache, `账房-${data.ledger.name}-${today()}.json`)
    if (file.exists) file.delete()
    file.create()
    await file.write(JSON.stringify(data))
    if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable')
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: '导出账本', UTI: 'public.json' })
    useSettings.getState().markExported()
  } catch (e) {
    showError(e)
  }
}

/** 大掌柜：把我的账本导成 Excel（.xlsx），用系统分享发出去，Excel、WPS 都能打开 */
export async function exportExcel() {
  try {
    const data = exportLedger(db, useSettings.getState().currentLedgerId)
    const bytes = buildXlsx('账目', excelRows(data), EXCEL_WIDTHS)
    const file = new File(Paths.cache, `账房-${data.ledger.name}-${today()}.xlsx`)
    if (file.exists) file.delete()
    file.create()
    await file.write(bytes)
    if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable')
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: '导出 Excel',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    })
  } catch (e) {
    showError(e)
  }
}

/** 选一个备份文件，确认后覆盖目标账本。成功返回 true */
export async function importIntoLedger(ledgerId: string) {
  try {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true })
    if (picked.canceled || !picked.assets[0]) return false
    const file = parseBackup(await new File(picked.assets[0].uri).text())
    const target = getLedger(db, ledgerId)
    const ok = await confirmHold(
      '导入备份',
      `备份来自「${file.ledger.name}」，共 ${file.transactions.filter((t) => !t.deletedAt).length} 笔账。\n导入后会覆盖「${target?.name ?? ''}」现在的全部数据，不能恢复。`,
      '按住覆盖导入',
    )
    if (!ok) return false
    importLedger(db, ledgerId, file)
    return true
  } catch (e) {
    showError(e)
    return false
  }
}
