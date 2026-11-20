import { iconSize } from '../theme'
import { RetroGlyph } from './RetroGlyph'

export type TabName = 'ledger' | 'stats' | 'chest' | 'me'

/** 底栏图标：自绘复古图标（明细·账本、统计·算盘、家当·箱笼、我的·人像），24px */
export function TabGlyph({ name, color }: { name: TabName; color: string }) {
  const glyph = { ledger: 'tab-ledger', stats: 'tab-abacus', chest: 'tab-chest', me: 'tab-me' }[name]
  return <RetroGlyph name={glyph} color={color} px={iconSize.nav} />
}
