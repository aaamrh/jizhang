import { StyleSheet } from 'react-native'
import type { Tier } from './types/domain'
import type { ColorKey } from './utils/iconCatalog'
import type { Necessity } from './utils/necessity'
import type { BookColor } from './utils/ledgerCover'
import { MONEY_GREEN, MONEY_RED } from './utils/amountColor'

// 设计令牌：页面和组件里的颜色、尺寸、间距只从这里取，不写字面量

/**
 * 新中式极简：浅宣纸底、近白纸面、墨色文字。
 * 颜色分工（见 docs/决策.md）：朱红 = 记一笔和每页主按钮、印章点缀、花出去的钱、危险操作；
 * 墨色 active = 选中、打开、当前页；绿 = 收入；金 = 提醒。不要用朱红表示“选中”。
 */
export const colors = {
  bg: '#F7F3EA', // 页面底色
  surface: '#FFFDF8', // 卡片、列表、底部面板
  fill: '#F0EADF', // 弱填充：分段控件底、进度条轨道、按下态
  ink: '#2B2118', // 主文字
  ink2: '#8C7F70', // 次要文字
  ink3: '#B9AFA2', // 占位、禁用、箭头
  hair: '#EDE6DA', // 细分隔线
  toggleRim: '#D8CDBA', // 开关关着时的细边（宣纸底上描一道）
  seal: '#B5322B', // 朱红
  active: '#2B2118', // 墨：开关打开、胶囊选中、底栏当前页、选中的日期/封面/成员
  green: '#3E5C56', // 黛青：收入、正向
  gold: '#B8893B', // 金：提醒
  white: '#FFFFFF',
  black: '#000000', // 看大图的底
  overlay: 'rgba(43,33,24,0.36)',
}

/**
 * 大掌柜（会员）专属：绛紫 + 鎏金 + 雷纹地（青铜器的底纹）。古时“朱紫贵”，紫为高官之色；明黄是皇帝专用，掌柜不僭越。
 * 只用在会员标识上（掌柜页头、会员卡、腰牌、头像金边、底栏小金点），别处不要用
 */
export const vip = {
  purple: '#4A2545', // 绛紫
  purpleDeep: '#2E1630', // 深紫（卡片下半、阴影）
  gold: '#C9A24D', // 鎏金
  goldLight: '#E8CF8A', // 浅金（字、高光）
}

/** 请帖（家庭账本邀请卡）：朱红洒金纸、金字。只用在请帖上 */
export const invite = {
  red: '#B5322B',
  redDeep: '#8A1F1A',
  gold: '#D9B45E',
  goldLight: '#F3DFA2',
  paper: '#FBF3E1', // 二维码底
} as const

/**
 * 金额颜色按中国人记账习惯：花出去的钱（支出、负数、超支、欠款）红，进来的钱（收入、正数）绿，零墨色。
 * 符号前缀照旧显示；颜色只是辅助。逻辑在 utils/amountColor（可测）
 */
export { amountColor } from './utils/amountColor'
/** 支出（金额是正数，但含义是钱出去了） */
export const expenseColor = MONEY_RED
/** 收入 */
export const incomeColor = MONEY_GREEN
/** 超出预算 */
export const overColor = MONEY_RED

/** 线装账簿封面的纸色（选项和名字在 utils/ledgerCover），签条和装订线 */
export const bookPaper: Record<BookColor, string> = {
  dianlan: '#2F4A6D', // 靛蓝
  zheshi: '#9C5B2E', // 赭石
  songlv: '#4E7D5B', // 松绿
  ouhe: '#8E6C8A', // 藕荷
  xiang: '#B8893B', // 缃色
  daiqing: '#3E5C56', // 黛青
}
export const bookSlip = '#F4ECDA'

/** 开关上的方孔铜钱：黄铜钱面、深一点的钱廓和孔廓。只用在开关上 */
export const coin = { face: '#D1A94E', rim: '#8C6A26' } as const
export const bookThread = '#EFE5D0'

/**
 * 连续记账的火苗：每档外焰、中焰、内焰三色（档位见 utils/streak 的 flameLevel）。
 * 金 → 橙 → 朱红一路变深；这是全 App 唯一的橙红色，是点缀不是警告。0 档是今天还没记时的灰火星
 */
export const flameColors: Record<0 | 1 | 2 | 3 | 4 | 5, readonly [string, string, string]> = {
  0: ['#CFC6B8', '#E3DBCF', '#F1ECE3'],
  1: ['#D9A441', '#EFC66C', '#F8E3A6'],
  2: ['#E08A2E', '#F2B04A', '#F8D98B'],
  3: ['#D2602A', '#EE9238', '#F7CF72'],
  4: ['#B5322B', '#E0702A', '#F6C75E'],
  5: ['#7E1A14', '#C8321E', '#FFE27A'], // 燎原：深红外焰、亮金芯，和烈火拉开（用户在两个方案里选的）
}

/** 分类可选的 8 个复古色（图标线条色；底色用 tint() 取 12% 透明度） */
export const categoryColors: Record<ColorKey, string> = {
  zhuhong: '#B5322B',
  daiqing: '#3E5C56',
  jin: '#B8893B',
  zheshi: '#9C5B2E',
  dianlan: '#2F4A6D',
  songlv: '#4E7D5B',
  ouhe: '#8E6C8A',
  mo: '#2B2118',
}

/** 档位颜色（降低饱和度）；只在统计里出现，记账界面不显示档位 */
export const tierColors: Record<Tier, string> = { need: '#6F8B84', flex: '#CDAE72', want: '#C98377' }

/** 必要性颜色：必要 黛青、非必要 赭红、待定 浅金 */
export const necessityColors: Record<Necessity, string> = { necessary: '#6F8B84', unnecessary: '#C98377', pending: '#D9C79E' }

/** '#RRGGBB' + 透明度 → rgba() */
export function tint(hex: string, alpha = 0.12) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** 间距 */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const
/** 页面左右边距 */
export const GUTTER = space.lg

/** 圆角 */
export const radius = { xs: 4, sm: 8, md: 12, sheet: 20, pill: 999 } as const

/** 图标尺寸：行内 16、列表和按钮 20、导航 24；圆底里的分类图标 22（40 圆）/ 28（52 圆） */
export const iconSize = { inline: 16, list: 20, nav: 24, glyph: 22, glyphLg: 28 } as const
export const ICON_STROKE = 1.5

/** 控件高度 */
export const size = {
  buttonLg: 48,
  buttonMd: 40,
  buttonSm: 32,
  input: 48,
  chip: 32,
  chipSm: 22, // 小胶囊：流水行里的标签
  swipeAction: 80, // 左滑露出的删除按钮宽度
  row: 56, // 单行列表行
  row2: 64, // 两行列表行
  navBar: 52,
  tabBar: 56,
  avatar: 56,
  circle: 40, // 列表行左侧的圆形图标底
  circleLg: 52, // 记账分类网格
  key: 56, // 记账键盘按键
  fab: 52, // 底栏中间的“记”：一方印（圆角方，比圆显大，所以比原来的圆小一号）
  bar: 4, // 进度条、排行条
  barThick: 8, // 三档占比条
  sheetMax: 480, // 底部面板内容最大高度
  chart: 120, // 柱状图高度
  qr: 200, // 邀请二维码
  seal: 28, // Logo 印章
  sealLg: 64, // 应用锁、会员页的大印章
  empty: 120, // 空状态远山插画宽度
  plaqueMini: 64, // 掌柜页心愿行右侧的小牌匾
  vipCardRatio: 1.586, // 会员卡宽高比（银行卡比例）
  yaopai: 22, // 腰牌高度
  inviteCard: 360, // 请帖最大宽度
  toggleW: 44, // 开关（铜钱钮）
  dialog: 320, // 弹窗最宽
  toggleH: 26,
  bookRow: 28, // 线装账簿封面宽度：列表行左侧
  bookSwatch: 32, // 选纸色
  bookHero: 84, // 账本页头、新建时的预览（宽 ≥ 56 才写书名）
  bookInvite: 40, // 请帖上
  todayDot: 4, // 日历里“今天”数字下面那一粒墨点
  flame: 18, // 首页“连续记账”前的小火苗
  flameMoment: 72, // 关口庆祝卡片上的大火苗
  perkArt: 150, // 开通提醒抽屉里每项权益的示意图高度
} as const

export const hairline = StyleSheet.hairlineWidth

// 字体：霞鹜文楷（楷体，复古书卷气）只用于标题、月份、金额等“展示”文字；正文、标签、按钮用系统无衬线
export const SERIF = 'LXGWWenKaiLite'

/** 字号与行高 */
export const type = {
  display: { fontSize: 32, lineHeight: 40 },
  amount: { fontSize: 28, lineHeight: 36 },
  title: { fontSize: 20, lineHeight: 28 },
  h2: { fontSize: 17, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
  tab: { fontSize: 11, lineHeight: 14 },
} as const

/** 轻阴影：代替卡片描边 */
export const shadow = { boxShadow: '0px 1px 3px rgba(43,33,24,0.06)' } as const
export const shadowRaised = { boxShadow: '0px 4px 14px rgba(43,33,24,0.12)' } as const
export const shadowSeal = { boxShadow: '0px 4px 12px rgba(181,50,43,0.32)' } as const

/** 长辈模式：字号和控件放大的倍数 */
export const ELDER_SCALE = 1.3
