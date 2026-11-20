import { and, count, eq } from 'drizzle-orm'
import { SALE_KEY, type LedgerType, type Tier, type WalletKind } from '../types/domain'
import type { ColorKey, IconName } from '../utils/iconCatalog'
import { uuidv5 } from '../utils/uuidv5'
import { inLedger, touched, type DB } from './core'
import { categories, wallets } from './schema'

export { SALE_KEY }

/** 默认分类 / 钱袋的 id：同一账本在任何设备上算出来都一样 */
export const defaultId = (ledgerId: string, key: string) => uuidv5(key, ledgerId)

// 图标与 assets/icons/retro.ts 里的 defaultFor 一一对应（测试里检查）
type Def = [key: string, name: string, icon: IconName, color: ColorKey, tier?: Tier]

// 默认顺序按大多数人的常用程度排，用户可以拖动调整
export const DEFAULT_EXPENSE: Def[] = [
  ['expense.dining', '外出就餐', 'bowl-chopsticks', 'zhuhong', 'flex'],
  ['expense.groceries', '买菜', 'veg-basket', 'songlv', 'need'],
  ['expense.daily', '日用', 'broom', 'zheshi', 'flex'],
  ['expense.commute', '通勤', 'carriage', 'dianlan', 'need'],
  ['expense.taxi', '打车', 'rickshaw', 'jin', 'flex'],
  ['expense.snacks', '零食饮品', 'lidded-cup', 'zheshi', 'want'],
  ['expense.clothing', '服饰', 'robe', 'ouhe', 'flex'],
  ['expense.housing', '住房', 'house', 'daiqing', 'need'],
  ['expense.utilities', '水电燃气', 'oil-lamp', 'jin', 'need'],
  ['expense.telecom', '通讯网费', 'letter', 'dianlan', 'need'],
  ['expense.digital', '数码', 'phone', 'mo', 'flex'],
  ['expense.fun', '娱乐', 'opera-mask', 'ouhe', 'want'],
  ['expense.treat', '聚会请客', 'hotpot', 'zhuhong', 'flex'],
  ['expense.gifts', '人情往来', 'gift-box', 'zhuhong', 'need'],
  ['expense.medical', '医疗', 'gourd', 'zhuhong', 'need'],
  ['expense.kids', '育儿', 'rattle-drum', 'ouhe', 'flex'],
  ['expense.pets', '宠物', 'cat', 'zheshi', 'flex'],
  ['expense.study', '学习', 'brush', 'daiqing', 'flex'],
  ['expense.travel', '旅行', 'canopy-boat', 'dianlan', 'want'],
  ['expense.drinks', '烟酒', 'wine-jar', 'zheshi', 'want'],
  ['expense.games', '游戏', 'dice', 'songlv', 'want'],
  ['expense.insurance', '保险', 'lock', 'daiqing', 'need'],
]

export const DEFAULT_INCOME: Def[] = [
  ['income.salary', '工资', 'coin', 'zhuhong'],
  ['income.bonus', '奖金', 'ingot', 'jin'],
  ['income.side', '副业', 'steelyard', 'daiqing'],
  ['income.invest', '理财收益', 'treasure-bowl', 'songlv'],
  ['income.redpacket', '红包礼金', 'red-packet', 'zhuhong'],
  [SALE_KEY, '变卖', 'shop-sign', 'jin'], // 系统分类：家当卖出用，不能隐藏或合并
  ['income.other', '其他', 'misc', 'mo'],
]

const PERSONAL_WALLETS: [key: string, name: string, kind: WalletKind][] = [
  ['wallet.cash', '现金', 'cash'],
  ['wallet.bank', '银行卡', 'bank'],
  ['wallet.alipay', '支付宝', 'alipay'],
  ['wallet.wechat', '微信', 'wechat'],
]
const FAMILY_WALLETS: typeof PERSONAL_WALLETS = [['wallet.family', '家用', 'cash']]

const catRow = (ledgerId: string, [key, name, icon, color, tier]: Def, type: 'expense' | 'income', sort: number) => ({
  id: defaultId(ledgerId, key),
  ledgerId,
  ...touched(),
  key,
  name,
  type,
  tier: type === 'expense' ? (tier ?? 'flex') : null,
  icon: `retro:${icon}`,
  color,
  sort,
})

/** 新账本写入默认钱袋和分类；该账本已有分类时什么都不做（只补系统分类） */
export function seedLedger(db: DB, ledgerId: string, type: LedgerType) {
  const n = db.select({ n: count() }).from(categories).where(eq(categories.ledgerId, ledgerId)).get()?.n ?? 0
  if (n > 0) return ensureSaleCategory(db, ledgerId)
  db.transaction((tx) => {
    tx.insert(categories)
      .values([
        ...DEFAULT_EXPENSE.map((d, i) => catRow(ledgerId, d, 'expense', i)),
        ...DEFAULT_INCOME.map((d, i) => catRow(ledgerId, d, 'income', i)),
      ])
      .run()
    tx.insert(wallets)
      .values(
        (type === 'family' ? FAMILY_WALLETS : PERSONAL_WALLETS).map(([key, name, kind], i) => ({
          id: defaultId(ledgerId, key),
          ledgerId,
          ...touched(),
          key,
          name,
          kind,
          sort: i,
        })),
      )
      .run()
  })
}

/** “变卖”是系统分类，导入的旧文件里可能没有，缺了就补上（被删过就恢复） */
export function ensureSaleCategory(db: DB, ledgerId: string) {
  const has = db.select({ id: categories.id }).from(categories).where(and(inLedger(categories, ledgerId), eq(categories.key, SALE_KEY))).get()
  if (has) return
  const row = catRow(ledgerId, DEFAULT_INCOME.find((d) => d[0] === SALE_KEY)!, 'income', 99)
  db.insert(categories)
    .values(row)
    .onConflictDoUpdate({ target: categories.id, set: { deletedAt: null, hidden: false, ...touched() } })
    .run()
}
