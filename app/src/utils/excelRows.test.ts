import { describe, expect, it } from 'vitest'
import { excelRows } from './excelRows'

const t = (o: Partial<Parameters<typeof excelRows>[0]['transactions'][number]>) => ({
  type: 'expense',
  amountCents: 3250,
  categoryId: 'c1',
  walletId: 'w1',
  toWalletId: null,
  date: '2026-11-18',
  note: '',
  review: null,
  deletedAt: null,
  createdAt: 1,
  ...o,
})

describe('导出 Excel 的表格', () => {
  it('一笔一行，新的在前，支出是负数，删掉的不导出，名字对上', () => {
    const rows = excelRows({
      transactions: [
        t({ date: '2026-11-17', type: 'income', amountCents: 800000, categoryId: 'c2', note: '工资' }),
        t({ review: 'unnecessary', tags: '["云南旅行","报销"]' }),
        t({ type: 'transfer', categoryId: null, toWalletId: 'w2', amountCents: 10000, date: '2026-11-16' }),
        t({ deletedAt: 5, note: '删掉的' }),
      ],
      categories: [
        { id: 'c1', name: '外出就餐' },
        { id: 'c2', name: '工资' },
      ],
      wallets: [
        { id: 'w1', name: '现金' },
        { id: 'w2', name: '储钱罐' },
      ],
    })
    expect(rows).toHaveLength(4)
    expect(rows[1]).toEqual(['2026-11-18', '支出', '外出就餐', -32.5, '现金', '', '', '云南旅行、报销', '非必要'])
    expect(rows[2]![3]).toBe(8000)
    expect(rows[3]!.slice(1, 6)).toEqual(['转账', '', 100, '现金', '储钱罐'])
  })
})
