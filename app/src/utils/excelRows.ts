// 导出 Excel 的表格内容（纯计算）：一笔账一行，按日期从新到旧；金额带正负号，在 Excel 里直接求和就是结余
import type { Cell } from './xlsx'
import { parseTags } from './tags'

type T = { type: string; amountCents: number; categoryId: string | null; walletId: string; toWalletId: string | null; date: string; note: string; review: string | null; tags?: string | null; deletedAt: number | null; createdAt: number }
type Named = { id: string; name: string }

const TYPE_LABEL: Record<string, string> = { expense: '支出', income: '收入', transfer: '转账', refund: '退款' }
const REVIEW_LABEL: Record<string, string> = { necessary: '必要', unnecessary: '非必要' }

export const EXCEL_HEADER = ['日期', '类型', '分类', '金额（元）', '钱袋', '转入钱袋', '备注', '标签', '复盘']
export const EXCEL_WIDTHS = [12, 6, 12, 12, 12, 12, 30, 16, 8]

export function excelRows(f: { transactions: T[]; categories: Named[]; wallets: Named[] }): Cell[][] {
  const cat = new Map(f.categories.map((c) => [c.id, c.name]))
  const wal = new Map(f.wallets.map((w) => [w.id, w.name]))
  const rows = f.transactions
    .filter((t) => t.deletedAt === null)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .map((t): Cell[] => [
      t.date,
      TYPE_LABEL[t.type] ?? t.type,
      t.categoryId ? (cat.get(t.categoryId) ?? '') : '',
      (t.type === 'expense' ? -1 : 1) * (t.amountCents / 100),
      wal.get(t.walletId) ?? '',
      t.toWalletId ? (wal.get(t.toWalletId) ?? '') : '',
      t.note,
      parseTags(t.tags).join('、'),
      t.review ? (REVIEW_LABEL[t.review] ?? '') : '',
    ])
  return [EXCEL_HEADER, ...rows]
}
