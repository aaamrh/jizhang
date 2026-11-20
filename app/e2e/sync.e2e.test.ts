// 端到端：在进程内启动真实后端（Fastify + PGlite，来自 api/test/helpers），
// 用两台"手机"（两个独立的 sql.js 数据库）通过 HTTP 同步。
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeApp, type TestApp } from '../../api/test/helpers'
import * as accountApi from '../src/api/accountApi'
import { ApiError, setApiBase, setAuthToken } from '../src/api/client'
import * as ledgerApi from '../src/api/ledgerApi'
import { newId, type DB } from '../src/db/core'
import { createLedger, listLedgers, listMembers } from '../src/db/ledgerRepo'
import { categories, transactions } from '../src/db/schema'
import { defaultId } from '../src/db/seed'
import { bindPersonalLedger, runSync, upsertRemoteLedger } from '../src/db/sync'
import { makeTestDb } from '../src/db/testDb'
import { addDays, today } from '../src/utils/dates'
import { createTxn } from '../src/db/txnRepo'

let t: TestApp

beforeAll(async () => {
  t = await makeApp()
  const address = await t.app.listen({ port: 0, host: '127.0.0.1' })
  setApiBase(address)
}, 30_000)
afterAll(() => t?.close())

/** 一台手机：自己的本地库 + 登录的账号；接口是模块级 token，操作前切到这台手机的 token */
async function device(token: string, choose: 'merge' | 'overwrite' = 'merge') {
  const { db, ledgerId } = await makeTestDb()
  const as = <T>(fn: () => Promise<T>) => {
    setAuthToken(token)
    return fn()
  }
  const sync = () => as(() => runSync(db, accountApi.sync))
  const bind = () =>
    as(() =>
      bindPersonalLedger(db, ledgerId, {
        listRemote: ledgerApi.listLedgers,
        createRemote: ledgerApi.createLedger,
        choose: async () => choose,
        isIdTaken: (e) => e instanceof ApiError && e.code === 'conflict',
      }),
    )
  return { db, ledgerId, as, sync, bind }
}

const spend = (db: DB, ledgerId: string, note: string, createdBy: string, walletKey = 'wallet.bank', memberId: string | null = null, date = '2026-11-17') =>
  createTxn(
    db,
    ledgerId,
    {
      type: 'expense',
      amountCents: 3500,
      categoryId: defaultId(ledgerId, 'expense.groceries'),
      walletId: defaultId(ledgerId, walletKey),
      toWalletId: null,
      date,
      note,
      asset: null,
      memberId,
    },
    createdBy,
  )
const notes = (db: DB, ledgerId: string) =>
  db
    .select({ note: transactions.note })
    .from(transactions)
    .where(eq(transactions.ledgerId, ledgerId))
    .all()
    .map((r) => r.note)
    .sort()

describe('端到端同步（真实后端）', () => {
  it('同一账号两台手机：A 记的账 B 拉得到；B 先记过账时合并', async () => {
    const u = await t.newUser()
    const a = await device(u.token)
    const personal = await a.bind()
    expect(personal).toBe(a.ledgerId)
    spend(a.db, personal, '手机A买菜', u.user.id)
    await a.sync()

    // B 也记过一笔，再登录同一账号 → 合并
    const b = await device(u.token, 'merge')
    spend(b.db, b.ledgerId, '手机B买菜', u.user.id)
    expect(await b.bind()).toBe(personal)
    await b.sync()
    expect(notes(b.db, personal)).toEqual(['手机A买菜', '手机B买菜'])

    // A 再同步，拿到 B 合并上来的那笔；默认分类没有重复
    await a.sync()
    expect(notes(a.db, personal)).toEqual(['手机A买菜', '手机B买菜'])
    const cats = (db: DB) => db.select().from(categories).all().filter((c) => c.ledgerId === personal && !c.deletedAt).length
    expect(cats(a.db)).toBe(cats(b.db))

    // B 删一笔，A 同步后也删了（软删除）
    const id = b.db.select().from(transactions).where(eq(transactions.note, '手机A买菜')).get()!.id
    b.db.update(transactions).set({ deletedAt: Date.now(), updatedAt: Date.now(), dirty: true }).where(eq(transactions.id, id)).run()
    await b.sync()
    await a.sync()
    expect(a.db.select().from(transactions).where(eq(transactions.id, id)).get()?.deletedAt).not.toBeNull()
  }, 30_000)

  it('家庭账本：各自记在自己的账本里，汇总里一家人的账都看得到；被移出后看不到', async () => {
    const boss = await t.newUser()
    const kid = await t.newUser()
    await t.grantVip(boss.user.id)
    const bd = await device(boss.token)
    const kd = await device(kid.token)
    const bp = await bd.bind()
    const kp = await kd.bind()

    // 老板建家庭账本（它不记账，本机不写默认数据），孩子用请帖加入
    const F = newId()
    upsertRemoteLedger(bd.db, await bd.as(() => ledgerApi.createLedger({ id: F, name: '王家', type: 'family' })))
    const inv = await bd.as(() => ledgerApi.createInvite(F))
    upsertRemoteLedger(kd.db, await kd.as(() => ledgerApi.acceptInvite(inv.code)))

    // 两个人各记一笔在自己的账本里（日期是今天：加入之后记的才汇进家庭账本），同步上去
    const day = today()
    spend(bd.db, bp, '买菜', boss.user.id, 'wallet.bank', null, day)
    spend(kd.db, kp, '文具', kid.user.id, 'wallet.bank', null, day)
    await bd.sync()
    await kd.sync()

    // 两边看家庭账本，都能看到两笔，记账人对得上
    for (const d of [bd, kd]) {
      const feed = await d.as(() => ledgerApi.familyFeed(F, day, addDays(day, 1)))
      expect(feed.active).toBe(true)
      expect(feed.items.map((i) => i.note).sort()).toEqual(['买菜', '文具'])
      expect(feed.items.find((i) => i.note === '文具')?.userId).toBe(kid.user.id)
      expect(feed.items.every((i) => i.category !== null)).toBe(true)
    }

    // 移出孩子：他看不到这个家庭账本了，同步后本机删掉它；他自己的账本不受影响
    await bd.sync() // 拉下孩子加入后的成员名单
    const kidMember = listMembers(bd.db, F).find((m) => m.userId === kid.user.id)!
    await bd.as(() => ledgerApi.removeMember(F, kidMember.id))
    await expect(kd.as(() => ledgerApi.familyFeed(F, day, addDays(day, 1)))).rejects.toBeInstanceOf(ApiError)
    const r = await kd.sync()
    expect(r.removed).toEqual([F])
    expect(listLedgers(kd.db).map((l) => l.type)).toEqual(['personal'])
    expect(notes(kd.db, kp)).toEqual(['文具'])
  }, 30_000)

  it('管理员给成员开长辈模式，成员同步时收到', async () => {
    const boss = await t.newUser()
    const elder = await t.newUser()
    await t.grantVip(boss.user.id)
    const bd = await device(boss.token)
    const ed = await device(elder.token)
    const F = newId()
    await bd.as(() => ledgerApi.createLedger({ id: F, name: '李家', type: 'family' }))
    const inv = await bd.as(() => ledgerApi.createInvite(F))
    await ed.as(() => ledgerApi.acceptInvite(inv.code))
    expect((await ed.sync()).elderOn).toBe(false)
    const m = (await bd.as(ledgerApi.listLedgers)).find((l) => l.id === F)!.members.find((x) => x.userId === elder.user.id)!
    await bd.as(() => ledgerApi.updateMember(F, m.id, { elderMode: true }))
    expect((await ed.sync()).elderOn).toBe(true)
  }, 30_000)
})
