import type { LedgerType } from '../types/domain'

/**
 * 账本封面：每本账都画成一本线装账簿，用户只选纸色（颜色值在 theme.bookPaper）。
 * cover 字段存纸色 key；早期版本存的是图标名（'house'、'lantern'……），认不出的一律按类型给默认色。
 */
export const BOOK_COLORS = ['dianlan', 'zheshi', 'songlv', 'ouhe', 'xiang', 'daiqing'] as const
export type BookColor = (typeof BOOK_COLORS)[number]
export const BOOK_COLOR_NAME: Record<BookColor, string> = { dianlan: '靛蓝', zheshi: '赭石', songlv: '松绿', ouhe: '藕荷', xiang: '缃色', daiqing: '黛青' }
export const DEFAULT_COVER: Record<LedgerType, BookColor> = { personal: 'dianlan', book: 'zheshi', family: 'songlv' }

const isBookColor = (c: string | null | undefined): c is BookColor => (BOOK_COLORS as readonly string[]).includes(c ?? '')
export const ledgerCover = (l: { type: LedgerType; cover: string | null }): BookColor => (isBookColor(l.cover) ? l.cover : DEFAULT_COVER[l.type])

/** 家庭账本起名建议 */
export const FAMILY_NAME_SUGGESTIONS = ['我们家', '一家人', '小家', '爸妈家', '柴米油盐'] as const
