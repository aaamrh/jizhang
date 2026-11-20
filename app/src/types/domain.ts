// 领域类型：pages / hooks 只认这些，不直接接触数据库行
import type { ColorKey, IconSpec } from '../utils/iconCatalog'
import type { Necessity } from '../utils/necessity'

export type { ColorKey, IconSpec, Necessity }

export type TxnType = 'expense' | 'income' | 'transfer' | 'refund'
export type CategoryType = 'expense' | 'income'
export type Tier = 'need' | 'flex' | 'want'
/** 复盘：必要 / 非必要；没复盘为 null */
export type Review = 'necessary' | 'unnecessary'
export type AssetStatus = 'holding' | 'sold' | 'lost' | 'broken'
export type WalletKind = 'cash' | 'bank' | 'alipay' | 'wechat' | 'lent' | 'credit' | 'huabei' | 'borrowed' | 'other' | 'jar'
/** 储钱罐：攒钱目标专用的钱袋，不出现在普通钱袋选择里（只在转账时可选） */
export const JAR_KIND: WalletKind = 'jar'

/** 系统分类“变卖”的稳定标识：家当卖出时使用，不能隐藏或合并 */
export const SALE_KEY = 'income.sale'
export const isSystemCategory = (c: { key: string | null }) => c.key === SALE_KEY

export const LIABILITY_KINDS: readonly WalletKind[] = ['credit', 'huabei', 'borrowed']

/** 钱袋种类对应的复古图标（assets/icons/retro.ts） */
export const WALLET_KIND_GLYPH: Record<WalletKind, string> = {
  cash: 'coin',
  bank: 'qianzhuang',
  alipay: 'ingot',
  wechat: 'red-packet',
  lent: 'brocade-pouch',
  other: 'treasure-bowl',
  credit: 'iou',
  huabei: 'iou',
  borrowed: 'iou',
  jar: 'treasure-bowl',
}

export const TIER_LABEL: Record<Tier, string> = { need: '必需', flex: '弹性', want: '享受' }
export const TIER_HINT: Record<Tier, string> = {
  need: '不花不行的：住、吃饭、看病、通勤',
  flex: '要花，但花多花少自己能控制',
  want: '图个开心，不买也不影响生活',
}

export const WALLET_KIND_LABEL: Record<WalletKind, string> = {
  cash: '现金',
  bank: '银行卡',
  alipay: '支付宝',
  wechat: '微信',
  lent: '借出（别人欠我）',
  other: '其他资产',
  credit: '信用卡',
  huabei: '花呗',
  borrowed: '借入（我欠别人）',
  jar: '储钱罐',
}

/** personal：我的账本（每人一个，记账都记在这里）；family：家庭账本（一家人账的汇总）；book：已取消的多账本，旧数据里可能还有，界面不显示 */
export type LedgerType = 'personal' | 'book' | 'family'

export const LEDGER_TYPE_LABEL: Record<LedgerType, string> = { personal: '记账都记在这里', book: '已停用的专项账本', family: '一家人的账汇在这里' }

export interface Ledger {
  id: string
  name: string
  type: LedgerType
  remote: boolean // 服务器上已有，参与同步
  myRole: 'admin' | 'member' | null // 本地账本为 null
  cover: string | null // 封面图标名；null = 按类型默认
}

export type MemberRole = 'admin' | 'member' | 'profile'

/** 账本成员（家人档案没有 userId） */
export interface Member {
  id: string
  ledgerId: string
  userId: string | null
  nickname: string
  role: MemberRole
  elderMode: boolean
  isMe: boolean
  removed: boolean // 已离开：历史账目照常显示名字，但不能再选
  isVip: boolean // 大掌柜
}


export interface Wallet {
  id: string
  ledgerId: string
  key: string | null
  name: string
  kind: WalletKind
  liability: boolean
  initialCents: number
  archived: boolean
  sort: number
}

export interface WalletWithBalance extends Wallet {
  balanceCents: number
}

export interface Category {
  id: string
  ledgerId: string
  name: string
  type: CategoryType
  tier: Tier | null
  icon: IconSpec
  color: ColorKey
  sort: number
  hidden: boolean
  key: string | null // 默认分类的稳定标识；'income.sale' 是系统分类“变卖”
}

export interface Txn {
  id: string
  ledgerId: string
  type: TxnType
  amountCents: number
  categoryId: string | null
  walletId: string
  toWalletId: string | null
  date: string
  note: string
  assetId: string | null
  review: Review | null
  createdBy: string | null // 记账人 userId，未登录为 null
  memberId: string | null // 谁花的；null = 记账人自己
  /** 标签（跨分类的记号），最多 3 个 */
  tags: string[]
  /** 周期记账自动记的：哪一条周期 */
  recurringId: string | null
  /** 小票、发票照片（同家当照片：photoFileId 云端 id；photo、photoCachedFor 只在本机） */
  photo: string | null
  photoFileId: string | null
  photoCachedFor: string | null
  createdAt: number
}

/** 列表展示用：带上分类、钱袋名称 */
export interface TxnView extends Txn {
  categoryName: string | null
  categoryIcon: IconSpec | null
  categoryColor: ColorKey
  tier: Tier | null
  walletName: string
  toWalletName: string | null
}

export type CostMode = 'day' | 'use'

export interface Asset {
  id: string
  ledgerId: string
  name: string
  costCents: number
  acquiredOn: string
  status: AssetStatus
  endedOn: string | null
  soldCents: number | null
  soldWalletId: string | null
  useCount: number
  note: string
  /** 计价方式：按天（默认，天天用的东西）或按次 */
  costMode: CostMode
  /** 照片在本机的路径（不同步） */
  photo: string | null // 本机缓存路径
  photoFileId: string | null // 云端文件 id（登录同步后才有）
  photoCachedFor: string | null // 本机缓存对应的云端 id
  fromTxn: boolean // 由一笔支出生成：买价和日期跟着那笔支出走
}

export interface CategoryAmount {
  categoryId: string
  name: string
  icon: IconSpec
  color: ColorKey
  tier: Tier | null
  cents: number
}

/** 一段时间（月、周、年）的收支汇总 */
export interface PeriodSummary {
  incomeCents: number
  expenseCents: number // 已扣除退款
  balanceCents: number
  txnCount: number
  /** 支出按必要性：复盘过的按标记，没复盘的按分类档位推定 */
  necessity: Record<Necessity, number>
  categories: CategoryAmount[] // 按金额从大到小，只含 > 0
  reviewed: number // 复盘过的笔数（弹性和享受里）
}

export interface MonthSummary extends PeriodSummary {
  month: string
}

export interface Budget {
  id: string
  ledgerId: string
  categoryId: string | null // null = 每月总预算
  amountCents: number
}

/** 一条预算的进度（总预算或某个分类） */
export interface BudgetLine {
  categoryId: string | null
  name: string
  icon: IconSpec | null
  color: ColorKey
  budgetCents: number
  spentCents: number
  leftCents: number
  ratio: number
  daysLeft: number
  perDayCents: number | null
}

export interface BudgetStatus {
  month: string
  total: BudgetLine | null
  categories: BudgetLine[]
}

export interface WeekReport {
  largest: TxnView | null // 最大的一笔支出
  recordDays: number // 这周记过账的天数
}

export interface YearReport {
  year: number
  summary: PeriodSummary
  months: { month: string; incomeCents: number; expenseCents: number }[]
  assetsAdded: number
  bestAsset: { name: string; perDayCents: number; days: number } | null // 日均最低的一件
  recordDays: number
  longestStreak: number
}

/** 常记：点一下就按今天记上一笔 */
export interface Template {
  id: string
  ledgerId: string
  name: string
  type: 'expense' | 'income'
  categoryId: string
  amountCents: number
  walletId: string
  note: string
  memberId: string | null
  tags: string[]
  sort: number
}

/** tags 不传：新建没有标签，修改时保留原来的 */
export type TemplateInput = Omit<Template, 'id' | 'ledgerId' | 'sort' | 'tags'> & { tags?: string[] }

/** 常记列表展示用：带分类图标 */
export interface TemplateView extends Template {
  categoryIcon: IconSpec | null
  categoryColor: ColorKey
}

/** 记一笔 / 编辑的输入 */
export interface TxnInput {
  type: TxnType
  amountCents: number
  categoryId: string | null
  walletId: string
  toWalletId: string | null
  date: string
  note: string
  asset: { name: string } | null // 支出“计入家当”
  memberId?: string | null // 家庭账本里“谁花的”，默认自己
  /** 不传：新记一笔没有标签；改账时保留原来的 */
  tags?: string[]
}

export type GoalStatus = 'active' | 'achieved' | 'archived'

/** 攒钱目标 */
export interface Goal {
  id: string
  ledgerId: string
  name: string
  targetCents: number
  deadline: string | null
  walletId: string // 专属储钱罐
  status: GoalStatus
  createdOn: string
  achievedOn: string | null
  achievedCents: number | null
  fulfilledOn: string | null
  wish: string
  photo: string | null // 本机缓存路径
  photoFileId: string | null // 云端文件 id（登录同步后才有）
  photoCachedFor: string | null // 本机缓存对应的云端 id
}

/** 带上储钱罐余额 */
export interface GoalView extends Goal {
  balanceCents: number
}

export interface GoalInput {
  name: string
  targetCents: number
  deadline: string | null
}
