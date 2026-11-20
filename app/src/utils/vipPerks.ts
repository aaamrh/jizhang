// 大掌柜的权益：开通提醒抽屉的 tab、大掌柜页的列表都从这里取；以后加权益只改这里（见 docs/需求.md 第 14 节）
export type PerkKey = 'family' | 'wishes' | 'calendar' | 'excel'

export interface Perk {
  key: PerkKey
  title: string
  /** 一句话说明 */
  line: string
  /** 复古图标名（assets/icons/retro） */
  glyph: string
}

export const VIP_PERKS: Perk[] = [
  { key: 'family', title: '家庭账本', line: '一家人各自记账，自动汇到一起看；家人加入免费', glyph: 'house' },
  { key: 'calendar', title: '记账日历', line: '按日历看每天花了多少，点哪天就补记哪天', glyph: 'lattice-window' },
  { key: 'excel', title: '导出 Excel', line: '把账导成表格，用 Excel、WPS 打开自己再算', glyph: 'abacus' },
  { key: 'wishes', title: '心愿不限', line: '免费可以同时攒 1 个心愿，开通后想攒几个攒几个', glyph: 'treasure-bowl' },
]
