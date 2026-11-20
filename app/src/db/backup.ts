import { eq, inArray } from 'drizzle-orm'
import { DomainError, inLedger, newId, removed, touched, type DB } from './core'
import { getLedger } from './ledgerRepo'
import {
  assets,
  budgets,
  categories,
  dayMarks,
  goals,
  recurrings,
  templates,
  transactions,
  wallets,
  type AssetRow,
  type BudgetRow,
  type CategoryRow,
  type DayMarkRow,
  type GoalRow,
  type RecurringRow,
  type TemplateRow,
  type TxnRow,
  type WalletRow,
} from './schema'
import { parseTags, tagsJson } from '../utils/tags'
import { defaultId, ensureSaleCategory } from './seed'

export const BACKUP_VERSION = 1

type Strip<R> = Omit<R, 'dirty'>

/** 导出文件：一个账本的全部行（含已删除的，以后同步有用）。本机设置不导出 */
export interface BackupFile {
  app: 'zhangfang'
  version: number
  exportedAt: number
  ledger: { id: string; name: string; type: string }
  wallets: Strip<WalletRow>[]
  categories: Strip<CategoryRow>[]
  transactions: Strip<TxnRow>[]
  assets: Strip<AssetRow>[]
  // 后来加的表：旧版本导出的文件里没有，按空处理
  budgets?: Strip<BudgetRow>[]
  dayMarks?: Strip<DayMarkRow>[]
  templates?: Strip<TemplateRow>[]
  goals?: Strip<GoalRow>[]
  recurrings?: Strip<RecurringRow>[]
}

const strip = <R extends { dirty: boolean }>({ dirty: _, ...rest }: R) => rest

/** keepLocalPhotos：只给本机内部搬账本用（首次登录合并），照片文件路径留着、云端 id 清空后重新上传；导出给用户的备份文件不含照片 */
export function exportLedger(db: DB, ledgerId: string, opts: { keepLocalPhotos?: boolean } = {}): BackupFile {
  const noPhoto = <R extends { photo: string | null }>(r: R) => ({ ...r, photo: opts.keepLocalPhotos ? r.photo : null, photoFileId: null, photoCachedFor: null })
  const ledger = getLedger(db, ledgerId)
  if (!ledger) throw new DomainError('账本不存在')
  return {
    app: 'zhangfang',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    ledger,
    wallets: db.select().from(wallets).where(eq(wallets.ledgerId, ledgerId)).all().map(strip),
    categories: db.select().from(categories).where(eq(categories.ledgerId, ledgerId)).all().map(strip),
    // 照片不放进备份文件（备份是给用户换机、存档用的；照片登录后走云端同步）
    transactions: db.select().from(transactions).where(eq(transactions.ledgerId, ledgerId)).all().map((r) => noPhoto(strip(r))),
    assets: db.select().from(assets).where(eq(assets.ledgerId, ledgerId)).all().map((r) => noPhoto(strip(r))),
    budgets: db.select().from(budgets).where(eq(budgets.ledgerId, ledgerId)).all().map(strip),
    dayMarks: db.select().from(dayMarks).where(eq(dayMarks.ledgerId, ledgerId)).all().map(strip),
    templates: db.select().from(templates).where(eq(templates.ledgerId, ledgerId)).all().map(strip),
    goals: db.select().from(goals).where(eq(goals.ledgerId, ledgerId)).all().map((r) => noPhoto(strip(r))),
    recurrings: db.select().from(recurrings).where(eq(recurrings.ledgerId, ledgerId)).all().map(strip),
  }
}

// 每列的类型；'?' 结尾表示可以为 null
type Spec = Record<string, 'string' | 'number' | 'boolean' | 'string?' | 'number?'>
const base: Spec = { id: 'string', updatedAt: 'number', deletedAt: 'number?' }
const SPECS: Record<'wallets' | 'categories' | 'transactions' | 'assets' | 'budgets' | 'dayMarks' | 'templates' | 'goals' | 'recurrings', Spec> = {
  wallets: { ...base, key: 'string?', name: 'string', kind: 'string', initialCents: 'number', archived: 'boolean', sort: 'number' },
  categories: {
    ...base,
    key: 'string?',
    name: 'string',
    type: 'string',
    tier: 'string?',
    icon: 'string',
    color: 'string',
    sort: 'number',
    hidden: 'boolean',
  },
  transactions: {
    ...base,
    type: 'string',
    amountCents: 'number',
    categoryId: 'string?',
    walletId: 'string',
    toWalletId: 'string?',
    date: 'string',
    note: 'string',
    assetId: 'string?',
    review: 'string?',
    createdBy: 'string?',
    memberId: 'string?',
    tags: 'string?', // 旧备份没有
    recurringId: 'string?',
    createdAt: 'number',
  },
  assets: {
    ...base,
    name: 'string',
    costCents: 'number',
    acquiredOn: 'string',
    status: 'string',
    endedOn: 'string?',
    soldCents: 'number?',
    soldWalletId: 'string?',
    useCount: 'number',
    note: 'string',
  },
  budgets: { ...base, categoryId: 'string?', amountCents: 'number' },
  dayMarks: { ...base, date: 'string' },
  templates: {
    ...base,
    name: 'string',
    type: 'string',
    categoryId: 'string',
    amountCents: 'number',
    walletId: 'string',
    note: 'string',
    memberId: 'string?',
    tags: 'string?',
    sort: 'number',
  },
  goals: {
    ...base,
    name: 'string',
    targetCents: 'number',
    deadline: 'string?',
    walletId: 'string',
    status: 'string',
    createdOn: 'string',
    achievedOn: 'string?',
    achievedCents: 'number?',
  },
  recurrings: {
    ...base,
    type: 'string',
    categoryId: 'string',
    amountCents: 'number',
    walletId: 'string',
    note: 'string',
    freq: 'string',
    startDate: 'string',
    endDate: 'string?',
    day: 'number?',
    month: 'number?',
    doneThrough: 'string?',
    paused: 'boolean',
  },
}
const OPTIONAL_TABLES = new Set(['budgets', 'dayMarks', 'templates', 'goals', 'recurrings'])

function checkRows(table: keyof typeof SPECS, rows: unknown) {
  if (!Array.isArray(rows)) throw new DomainError('文件内容不完整')
  const spec = SPECS[table]
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) throw new DomainError('文件内容损坏')
    for (const [k, type] of Object.entries(spec)) {
      const v = (row as Record<string, unknown>)[k]
      if (type.endsWith('?') && (v === null || v === undefined)) continue
      if (typeof v !== type.replace('?', '')) throw new DomainError('文件内容损坏，无法导入')
    }
  }
}

/** 解析并校验导出文件；不合法时抛出给用户看的错误 */
export function parseBackup(text: string): BackupFile {
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new DomainError('这不是账房的备份文件')
  }
  if (data?.app !== 'zhangfang') throw new DomainError('这不是账房的备份文件')
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new DomainError('备份文件来自更新版本的账房，请先升级 App')
  }
  if (typeof data.ledger?.id !== 'string') throw new DomainError('文件内容不完整')
  for (const t of Object.keys(SPECS) as (keyof typeof SPECS)[]) {
    if (OPTIONAL_TABLES.has(t) && data[t] === undefined) data[t] = []
    checkRows(t, data[t])
  }
  return data as BackupFile
}

/**
 * 用备份覆盖某个账本的全部数据（一次事务，失败则原数据不变）。
 * - 导回原账本：保留原 id；
 * - 导进别的账本：所有 id 重新生成（默认分类 / 钱袋按 key 重算 v5），引用一并替换，
 *   这样同一个文件导进两个账本也不会撞 id，同步时也不会出现“记录跨账本”。
 * 原有数据是软删除，以后同步时会把删除传到云端。
 */
export function importLedger(db: DB, targetId: string, file: BackupFile, opts: { keepLocalPhotos?: boolean } = {}) {
  const photoOf = (r: { photo?: string | null }) => ({ photo: opts.keepLocalPhotos ? (r.photo ?? null) : null, photoFileId: null, photoCachedFor: null })
  if (!getLedger(db, targetId)) throw new DomainError('账本不存在')
  const same = file.ledger.id === targetId
  const ids = new Map<string, string>()
  const remap = <R extends { id: string }>(rows: R[], keyOf: (r: R) => string | null = () => null) =>
    rows.forEach((r) => {
      const key = keyOf(r)
      ids.set(r.id, same ? r.id : key ? defaultId(targetId, key) : newId())
    })
  remap(file.wallets, (r) => r.key ?? null)
  remap(file.categories, (r) => r.key ?? null)
  remap(file.assets)
  remap(file.recurrings ?? [])
  remap(file.transactions)
  const ref = (id: string | null | undefined) => (id ? (ids.get(id) ?? id) : null)
  const own = { ledgerId: targetId, ...touched() }

  const w = file.wallets.map((r) => ({ ...r, ...own, id: ids.get(r.id)!, key: r.key ?? null }))
  const c = file.categories.map((r) => ({ ...r, ...own, id: ids.get(r.id)!, key: r.key ?? null }))
  const a = file.assets.map((r) => ({ ...r, ...own, id: ids.get(r.id)!, soldWalletId: ref(r.soldWalletId), ...photoOf(r) }))
  const t = file.transactions.map((r) => ({
    ...r,
    ...own,
    id: ids.get(r.id)!,
    categoryId: ref(r.categoryId),
    walletId: ref(r.walletId)!,
    toWalletId: ref(r.toWalletId),
    assetId: ref(r.assetId),
    createdBy: r.createdBy ?? null,
    memberId: same ? (r.memberId ?? null) : null, // 成员属于原账本，换账本后归记账人自己
    tags: tagsJson(parseTags(r.tags)),
    recurringId: ref(r.recurringId),
    ...photoOf(r),
  }))
  // 预算和“今天没花钱”的 id 由账本、分类、日期算出，换账本时按新值重算
  const b = (file.budgets ?? []).map((r) => {
    const categoryId = ref(r.categoryId)
    return { ...r, ...own, categoryId, id: same ? r.id : defaultId(targetId, `budget:${categoryId ?? 'total'}`) }
  })
  const d = (file.dayMarks ?? []).map((r) => ({ ...r, ...own, id: same ? r.id : defaultId(targetId, `nospend:${r.date}`) }))
  const q = (file.templates ?? []).map((r) => ({
    ...r,
    ...own,
    id: same ? r.id : newId(),
    categoryId: ref(r.categoryId)!,
    walletId: ref(r.walletId)!,
    memberId: same ? (r.memberId ?? null) : null,
    tags: tagsJson(parseTags(r.tags)),
  }))
  const g = (file.goals ?? []).map((r) => ({ ...r, ...own, id: same ? r.id : newId(), walletId: ref(r.walletId)!, wish: r.wish ?? '', ...photoOf(r) }))
  const p = (file.recurrings ?? []).map((r) => ({ ...r, ...own, id: ids.get(r.id)!, categoryId: ref(r.categoryId)!, walletId: ref(r.walletId)! }))

  db.transaction((tx) => {
    const tables = [
      [wallets, w],
      [categories, c],
      [assets, a],
      [transactions, t],
      [budgets, b],
      [dayMarks, d],
      [templates, q],
      [goals, g],
      [recurrings, p],
    ] as const
    for (const [table, rows] of tables) {
      tx.update(table).set(removed()).where(inLedger(table, targetId)).run()
      const incoming = rows.map((r) => r.id)
      // 分批，避免超出 SQLite 单条语句的参数上限
      for (let i = 0; i < incoming.length; i += 200) tx.delete(table).where(inArray(table.id, incoming.slice(i, i + 200))).run()
      for (let i = 0; i < rows.length; i += 50) tx.insert(table).values(rows.slice(i, i + 50) as any).run()
    }
    ensureSaleCategory(tx, targetId)
  })
}
