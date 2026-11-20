import { and, asc, desc, eq } from 'drizzle-orm'
import { toGoal } from '../mapper/goal'
import { JAR_KIND, type GoalInput, type GoalView } from '../types/domain'
import { VIP_NAME } from '../utils/copy'
import { reached } from '../utils/goals'
import { DomainError, inLedger, newId, touched, type DB } from './core'
import { goals, wallets } from './schema'
import { createWallet, walletFlows } from './walletRepo'

/** 一个账本的目标，带储钱罐余额（余额 = 初始 + 存入 − 取出） */
export function listGoals(db: DB, ledgerId: string): GoalView[] {
  const flows = walletFlows(db, ledgerId)
  const init = new Map(
    db
      .select({ id: wallets.id, c: wallets.initialCents })
      .from(wallets)
      .where(eq(wallets.ledgerId, ledgerId))
      .all()
      .map((r) => [r.id, r.c]),
  )
  return db
    .select()
    .from(goals)
    .where(inLedger(goals, ledgerId))
    .orderBy(asc(goals.createdOn), desc(goals.updatedAt))
    .all()
    .map((r) => {
      const g = toGoal(r)
      return { ...g, balanceCents: (init.get(g.walletId) ?? 0) + (flows.get(g.walletId) ?? 0) }
    })
}

export const getGoal = (db: DB, ledgerId: string, id: string) => listGoals(db, ledgerId).find((g) => g.id === id)

function check(v: GoalInput) {
  const name = v.name.trim()
  if (!name) throw new DomainError('给目标起个名字，比如“年底旅行”')
  if (Array.from(name).length > 16) throw new DomainError('名字最多 16 个字')
  if (!Number.isInteger(v.targetCents) || v.targetCents <= 0) throw new DomainError('请输入目标金额')
  return name
}

/**
 * 立一个目标：同时建一个专属储钱罐。
 * maxActive：免费用户同时只能进行 1 个（页面会先引导开通会员，这里兜底）
 */
export function createGoal(db: DB, ledgerId: string, v: GoalInput, today: string, maxActive = Infinity): string {
  const name = check(v)
  const active = listGoals(db, ledgerId).filter((g) => g.status === 'active').length
  if (active >= maxActive) throw new DomainError(`同时只能进行 ${maxActive} 个目标，开通${VIP_NAME}不限`)
  const id = newId()
  db.transaction((tx) => {
    const walletId = createWallet(tx as DB, ledgerId, { name: `储钱罐·${name}`, kind: JAR_KIND, initialCents: 0 })
    tx.insert(goals).values({ id, ledgerId, ...touched(), name, targetCents: v.targetCents, deadline: v.deadline, walletId, status: 'active', createdOn: today }).run()
  })
  return id
}

/** 修改名称、金额、期限（只有进行中的能改；储钱罐名字跟着改） */
export function updateGoal(db: DB, ledgerId: string, id: string, v: GoalInput) {
  const name = check(v)
  const g = getGoal(db, ledgerId, id)
  if (!g) throw new DomainError('目标不存在')
  if (g.status !== 'active') throw new DomainError('攒够了或收起来的目标不能再改')
  db.transaction((tx) => {
    tx.update(goals).set({ name, targetCents: v.targetCents, deadline: v.deadline, ...touched() }).where(eq(goals.id, id)).run()
    tx.update(wallets).set({ name: `储钱罐·${name}`, ...touched() }).where(eq(wallets.id, g.walletId)).run()
  })
}

/** 先收起来：目标留档（不进心愿），储钱罐里的钱照旧在，可以转出 */
export function archiveGoal(db: DB, id: string) {
  db.update(goals).set({ status: 'archived', ...touched() }).where(and(eq(goals.id, id), eq(goals.status, 'active'))).run()
}

/**
 * 检查进行中的目标：储钱罐余额第一次 ≥ 目标即达成，冻结达成日期和金额。
 * 返回这次新达成的目标 id（用于弹出牌匾）。
 */
export function checkGoals(db: DB, ledgerId: string, today: string): string[] {
  const done: string[] = []
  for (const g of listGoals(db, ledgerId)) {
    if (g.status !== 'active' || !reached(g.targetCents, g.balanceCents)) continue
    db.update(goals)
      .set({ status: 'achieved', achievedOn: today, achievedCents: g.balanceCents, ...touched() })
      .where(and(eq(goals.id, g.id), eq(goals.status, 'active')))
      .run()
    done.push(g.id)
  }
  return done
}

/** 圆梦：只有攒够了、还没圆梦的目标可以；写一句话、配一张照片都是可选的 */
export function fulfillGoal(db: DB, ledgerId: string, id: string, v: { wish: string; photo: string | null }, today: string) {
  const g = getGoal(db, ledgerId, id)
  if (!g) throw new DomainError('目标不存在')
  if (g.status !== 'achieved') throw new DomainError('攒够了才能圆梦')
  if (g.fulfilledOn) throw new DomainError('这个心愿已经圆过了')
  db.update(goals)
    .set({ fulfilledOn: today, wish: v.wish.trim().slice(0, 40), photo: v.photo, photoFileId: null, photoCachedFor: null, ...touched() })
    .where(eq(goals.id, id))
    .run()
}

/** 储钱罐 → 目标（转账时判断是不是在往目标里存、从目标里取） */
export const goalByWallet = (db: DB, ledgerId: string, walletId: string | null) =>
  walletId ? listGoals(db, ledgerId).find((g) => g.walletId === walletId) : undefined

/** 改期限（到期没攒够时一键延期） */
export function postponeGoal(db: DB, ledgerId: string, id: string, deadline: string) {
  const g = getGoal(db, ledgerId, id)
  if (!g || g.status !== 'active') throw new DomainError('只有进行中的目标可以改日子')
  db.update(goals).set({ deadline, ...touched() }).where(eq(goals.id, id)).run()
}
