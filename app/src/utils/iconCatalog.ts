// 分类图标目录：数据来自 assets/icons/retro.ts（自绘复古线描图标），纯数据，可在 Node 里测试。
import { RETRO_GROUPS, RETRO_ICONS } from '../assets/icons/retro'

export const ICON_GROUPS = RETRO_GROUPS
export type IconGroup = string

/** 可用作分类的图标（导航用的 tab-* 不在其中） */
export const ICONS = Object.entries(RETRO_ICONS)
  .filter(([, ic]) => RETRO_GROUPS.includes(ic.group))
  .map(([name, ic]) => ({ name, label: ic.label, group: ic.group, keywords: [...ic.keywords, ...(ic.defaultFor ?? [])] }))

export type IconName = string

const BY_NAME = new Map(ICONS.map((i) => [i.name, i]))
export const isIconName = (s: string): s is IconName => BY_NAME.has(s)
export const iconsInGroup = (g: IconGroup) => ICONS.filter((i) => i.group === g).map((i) => i.name)
export const iconLabel = (name: IconName) => BY_NAME.get(name)?.label ?? name

export const FALLBACK_ICON: IconName = 'misc'

/** 默认分类的图标：retro.ts 里 defaultFor 写明了每个默认分类用哪个 */
export function defaultIconFor(categoryName: string): IconName {
  for (const [name, ic] of Object.entries(RETRO_ICONS)) if (ic.defaultFor?.includes(categoryName)) return name
  return FALLBACK_ICON
}

/** 按名称推荐图标：名称里包含的关键词越长越优先；都不中返回 null */
export function suggestIcon(name: string): IconName | null {
  const n = name.trim()
  if (!n) return null
  let best: IconName | null = null
  let score = 0
  for (const icon of ICONS) {
    for (const k of icon.keywords) {
      const s = n === k ? 100 : n.includes(k) ? k.length : 0
      if (s > score) {
        score = s
        best = icon.name
      }
    }
  }
  return best
}

// ---- 旧版本存的 Lucide 图标 → 最接近的复古图标；表里没有的按分类名称推荐，再不行用“祥云” ----
const LEGACY: Record<string, IconName> = {
  utensils: 'bowl-chopsticks',
  'chef-hat': 'bowl-chopsticks',
  soup: 'bowl-chopsticks',
  sandwich: 'steamer',
  croissant: 'steamer',
  carrot: 'veg-basket',
  apple: 'veg-basket',
  salad: 'veg-basket',
  'shopping-basket': 'broom',
  'shopping-cart': 'broom',
  'train-front': 'carriage',
  bus: 'carriage',
  car: 'carriage',
  bike: 'carriage',
  'car-taxi-front': 'rickshaw',
  plane: 'canopy-boat',
  luggage: 'canopy-boat',
  fuel: 'arch-bridge',
  'cup-soda': 'lidded-cup',
  coffee: 'lidded-cup',
  cookie: 'tanghulu',
  'cake-slice': 'tanghulu',
  'ice-cream-cone': 'tanghulu',
  wine: 'wine-jar',
  beer: 'wine-pot',
  fish: 'fish',
  'cooking-pot': 'hotpot',
  'hand-platter': 'hotpot',
  shirt: 'robe',
  footprints: 'cloth-shoe',
  umbrella: 'paper-umbrella',
  gem: 'jade-pendant',
  house: 'house',
  sofa: 'lattice-window',
  zap: 'oil-lamp',
  lamp: 'oil-lamp',
  wifi: 'letter',
  mail: 'red-packet',
  smartphone: 'phone',
  laptop: 'phone',
  tv: 'phone',
  camera: 'phone',
  clapperboard: 'opera-mask',
  'gamepad-2': 'dice',
  music: 'drum',
  gift: 'gift-box',
  'heart-pulse': 'gourd',
  stethoscope: 'gourd',
  pill: 'herb-pot',
  dumbbell: 'taiji',
  baby: 'rattle-drum',
  'paw-print': 'cat',
  cat: 'cat',
  dog: 'cat',
  'book-open': 'brush',
  book: 'thread-book',
  'graduation-cap': 'thread-book',
  scissors: 'scissors',
  key: 'old-key',
  'shield-check': 'lock',
  banknote: 'coin',
  coins: 'coin',
  trophy: 'ingot',
  'briefcase-business': 'steelyard',
  'trending-up': 'treasure-bowl',
  landmark: 'treasure-bowl',
  'piggy-bank': 'pouch',
  wallet: 'pouch',
  'hand-coins': 'shop-sign',
  flower: 'plum',
  sprout: 'bamboo',
  'circle-ellipsis': 'misc',
}

// ---- 分类图标的存储格式：'retro:bowl-chopsticks' 或 'char:食'（旧版本是 'lucide:utensils'） ----

export type IconSpec = { kind: 'retro'; name: IconName } | { kind: 'char'; char: string }

/** 取第一个“字”（按码点，避免把生僻字切坏） */
export const firstChar = (s: string) => Array.from(s.trim())[0] ?? '?'

/** 旧的 Lucide 名称 → 复古图标 */
export const legacyIcon = (lucideName: string, categoryName: string): IconName =>
  LEGACY[lucideName] ?? suggestIcon(categoryName) ?? FALLBACK_ICON

export function parseIcon(raw: string | null | undefined, categoryName: string): IconSpec {
  if (raw?.startsWith('retro:')) {
    const name = raw.slice(6)
    if (isIconName(name)) return { kind: 'retro', name }
  }
  if (raw?.startsWith('lucide:')) return { kind: 'retro', name: legacyIcon(raw.slice(7), categoryName) }
  if (raw?.startsWith('char:') && raw.length > 5) return { kind: 'char', char: firstChar(raw.slice(5)) }
  return { kind: 'char', char: firstChar(categoryName) }
}

export const formatIcon = (spec: IconSpec) => (spec.kind === 'retro' ? `retro:${spec.name}` : `char:${spec.char}`)

// ---- 8 个复古色（色值在 theme.ts） ----
export const COLOR_KEYS = ['zhuhong', 'daiqing', 'jin', 'zheshi', 'dianlan', 'songlv', 'ouhe', 'mo'] as const
export type ColorKey = (typeof COLOR_KEYS)[number]
export const COLOR_LABEL: Record<ColorKey, string> = {
  zhuhong: '朱红',
  daiqing: '黛青',
  jin: '金',
  zheshi: '赭石',
  dianlan: '靛蓝',
  songlv: '松绿',
  ouhe: '藕荷',
  mo: '墨',
}
