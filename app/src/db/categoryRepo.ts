import { and, asc, eq, like, max } from 'drizzle-orm'
import { toCategory } from '../mapper/category'
import { isSystemCategory, SALE_KEY, type Category, type CategoryType, type Tier } from '../types/domain'
import { COLOR_KEYS, formatIcon, isIconName, legacyIcon, type ColorKey, type IconSpec } from '../utils/iconCatalog'
import { DomainError, inLedger, newId, removed, touched, type DB } from './core'
import { categories as c, transactions as t } from './schema'

export interface CategoryInput {
  name: string
  icon: IconSpec
  color: ColorKey
  tier: Tier | null
}

export function listCategories(db: DB, ledgerId: string, opts: { type?: CategoryType; includeHidden?: boolean } = {}): Category[] {
  return db
    .select()
    .from(c)
    .where(
      and(
        inLedger(c, ledgerId),
        opts.type ? eq(c.type, opts.type) : undefined,
        opts.includeHidden ? undefined : eq(c.hidden, false),
      ),
    )
    .orderBy(asc(c.sort))
    .all()
    .map(toCategory)
}

/** 含已删除的（老账目要显示名字） */
export function getCategory(db: DB, id: string) {
  const r = db.select().from(c).where(eq(c.id, id)).get()
  return r ? toCategory(r) : undefined
}

export function saleCategory(db: DB, ledgerId: string) {
  const r = db.select().from(c).where(and(inLedger(c, ledgerId), eq(c.key, SALE_KEY))).get()
  if (!r) throw new DomainError('缺少“变卖”分类，请重启 App')
  return toCategory(r)
}

function clean(v: CategoryInput) {
  const name = v.name.trim()
  if (!name) throw new DomainError('请填写分类名称')
  if (Array.from(name).length > 8) throw new DomainError('分类名称最多 8 个字')
  if (v.icon.kind === 'retro' && !isIconName(v.icon.name)) throw new DomainError('图标不存在')
  if (v.icon.kind === 'char' && Array.from(v.icon.char.trim()).length !== 1) throw new DomainError('印章只能放一个字')
  if (!COLOR_KEYS.includes(v.color)) throw new DomainError('颜色不存在')
  return { name, icon: formatIcon(v.icon), color: v.color }
}

export function createCategory(db: DB, ledgerId: string, v: CategoryInput & { type: CategoryType }) {
  const [{ m } = { m: 0 }] = db
    .select({ m: max(c.sort) })
    .from(c)
    .where(and(eq(c.ledgerId, ledgerId), eq(c.type, v.type)))
    .all()
  const id = newId()
  db.insert(c)
    .values({
      id,
      ledgerId,
      ...touched(),
      ...clean(v),
      type: v.type,
      tier: v.type === 'expense' ? (v.tier ?? 'flex') : null,
      sort: (m ?? 0) + 1,
    })
    .run()
  return id
}

export function updateCategory(db: DB, id: string, v: CategoryInput) {
  const cur = getCategory(db, id)
  if (!cur) throw new DomainError('分类不存在')
  db.update(c)
    .set({ ...clean(v), tier: cur.type === 'expense' ? (v.tier ?? 'flex') : null, ...touched() })
    .where(eq(c.id, id))
    .run()
}

export function setCategoryHidden(db: DB, id: string, hidden: boolean) {
  const cur = getCategory(db, id)
  if (hidden && cur && isSystemCategory(cur)) throw new DomainError('这是系统分类，不能隐藏')
  db.update(c).set({ hidden, ...touched() }).where(eq(c.id, id)).run()
}

/** 按传入顺序重排（拖动排序后调用） */
export function reorderCategories(db: DB, ids: string[]) {
  db.transaction((tx) => {
    ids.forEach((id, i) => tx.update(c).set({ sort: i, ...touched() }).where(eq(c.id, id)).run())
  })
}

/** 合并：from 的历史账目全部转到 into，from 消失 */
export function mergeCategory(db: DB, fromId: string, intoId: string) {
  const from = getCategory(db, fromId)
  const into = getCategory(db, intoId)
  if (!from || !into || fromId === intoId) throw new DomainError('请选择另一个分类')
  if (isSystemCategory(from)) throw new DomainError('这是系统分类，不能合并')
  if (from.type !== into.type) throw new DomainError('支出分类只能合并到支出分类，收入同理')
  if (from.ledgerId !== into.ledgerId) throw new DomainError('只能合并同一账本里的分类')
  db.transaction((tx) => {
    tx.update(t).set({ categoryId: intoId, ...touched() }).where(eq(t.categoryId, fromId)).run()
    tx.update(c).set(removed()).where(eq(c.id, fromId)).run()
  })
}

/**
 * 旧版本存的 Lucide 图标（'lucide:*'）改成最接近的复古图标，并标记待同步。
 * 启动时执行一次；读的时候 parseIcon 也会兼容，防止别的手机上传旧值。
 */
export function migrateLegacyIcons(db: DB) {
  const rows = db.select({ id: c.id, icon: c.icon, name: c.name }).from(c).where(like(c.icon, 'lucide:%')).all()
  for (const r of rows) {
    db.update(c)
      .set({ icon: `retro:${legacyIcon(r.icon.slice(7), r.name)}`, ...touched() })
      .where(eq(c.id, r.id))
      .run()
  }
  return rows.length
}
