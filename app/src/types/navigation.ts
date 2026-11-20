import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { CategoryType, Necessity } from './domain'

export type TabParams = {
  Home: undefined
  Stats: { week?: string } | undefined // week：打开时直接看这一周（周日提醒点进来）
  Assets: undefined
  Mine: undefined
}

export type RootParams = {
  Tabs: NavigatorScreenParams<TabParams>
  // copyFrom：再记一笔同样的；transferTo / transferFrom：往储钱罐存一笔、从储钱罐取出（预填成转账）
  EntryEdit: { id?: string; copyFrom?: string; transferTo?: string; transferFrom?: string; date?: string } // date：新记一笔的日期（记账日历里补记某天）
  Budget: undefined
  YearReport: { year?: number } // 默认今年
  ElderHome: undefined // 长辈模式首页（这个月）
  ElderEntry: undefined // 长辈模式记一笔
  Review: { month: string } // 复盘
  Search: undefined
  Calendar: undefined // 记账日历（大掌柜）
  Tag: { name: string } // 一个标签的所有账，可改名、删除
  Tags: undefined // 所有标签
  AssetDetail: { id: string }
  AssetForm: { id?: string }
  AssetSell: { id: string }
  Calibrate: { ledgerId?: string }
  Wallets: undefined
  WalletForm: { id?: string }
  Categories: undefined
  CategoryForm: { id?: string; type: CategoryType }
  CategoryMerge: { id: string }
  Backup: undefined
  About: undefined
  Login: undefined
  Legal: { kind: 'terms' | 'privacy' }
  Account: undefined
  Templates: undefined // 常记
  TemplateForm: { id?: string; fromTxn?: string } | undefined // fromTxn：从这笔账存为常记
  Recurrings: undefined // 周期记账
  RecurringForm: { id?: string; fromTxn?: string } // fromTxn：把这笔账设为周期记账
  Ledgers: undefined // 账本：我的账本、家庭账本
  LedgerDetail: { id: string }
  Invite: { ledgerId: string }
  FamilyCreate: undefined // 新建家庭账本：起名、封面 → 家人档案 → 请帖
  Join: { code?: string } // 邀请链接 zhangfang://invite/<code> 打开这里
  Vip: { reason?: string } | undefined
  Achievements: undefined // 心愿：攒钱目标 + 如愿
  GoalForm: { id?: string } | undefined
  GoalFulfill: { id: string } // 攒够之后：圆梦（盖章、写一句话、配张照片）
}

export type StackProps<K extends keyof RootParams> = NativeStackScreenProps<RootParams, K>
export type TabProps<K extends keyof TabParams> = CompositeScreenProps<
  BottomTabScreenProps<TabParams, K>,
  NativeStackScreenProps<RootParams>
>

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootParams {}
  }
}
