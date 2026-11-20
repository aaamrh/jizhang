// 圆梦印章（白文方印）的版式和斑驳：纯计算，不依赖 RN。印面坐标 0..100。

/** 印文：四字成语，按印章规矩从右列往左列读 */
export const SEAL_PHRASE = '不负韶华'

/** 记完一笔盖的章 */
export const ENTRY_STAMP = '入账'

/**
 * 印文排版（基线位置和字号）：一个字居中；两个字上下竖排（不左右排，免得被读成“账入”）；
 * 四个字按印章规矩，右列放第 1、2 字，左列放第 3、4 字。超过四个字只取前四个。
 */
export function sealChars(phrase: string = SEAL_PHRASE) {
  const chars = Array.from(phrase).slice(0, 4)
  const layout: Record<number, { pos: (readonly [number, number])[]; size: number }> = {
    1: { pos: [[50, 73]], size: 64 },
    2: { pos: [[50, 46], [50, 91]], size: 43 },
    3: { pos: [[71, 44], [71, 88], [29, 66]], size: 39 },
    4: { pos: [[71, 44], [71, 88], [29, 44], [29, 88]], size: 39 },
  }
  const l = layout[chars.length] ?? layout[1]!
  return chars.map((ch, i) => ({ ch, x: l.pos[i]![0], y: l.pos[i]![1], size: l.size }))
}

export type Speck = { kind: 'dot'; cx: number; cy: number; rx: number; ry: number; rot: number } | { kind: 'notch'; x: number; y: number; w: number; h: number }

/** 字符串 → 32 位种子（FNV-1a） */
function hash(s: string) {
  let h = 2166136261
  for (const c of s) {
    h ^= c.codePointAt(0)!
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

/**
 * 斑驳：印泥没压匀的小白点（一半以上靠近边缘）和边框上的两三处缺口。
 * 同一个种子（同一块匾）每次生成的都一样，不同的匾各不相同。
 */
export function sealWear(seed: string, dots = 80): Speck[] {
  let s = hash(seed)
  const r = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  const out: Speck[] = []
  for (let i = 0; i < dots; i++) {
    let cx = r() * 100
    let cy = r() * 100
    if (r() < 0.55) {
      if (r() < 0.5) cx = r() < 0.5 ? 2 + r() * 6 : 98 - r() * 6
      else cy = r() < 0.5 ? 2 + r() * 6 : 98 - r() * 6
    }
    out.push({ kind: 'dot', cx, cy, rx: 0.5 + r() * 1.6, ry: 0.4 + r() * 1.2, rot: r() * 180 })
  }
  for (let i = 0; i < 3; i++) {
    const side = Math.floor(r() * 4)
    const t = 15 + r() * 70
    const len = 2 + r() * 3
    out.push(
      side === 0
        ? { kind: 'notch', x: t, y: 0, w: len, h: 4 }
        : side === 1
          ? { kind: 'notch', x: 96, y: t, w: 4, h: len }
          : side === 2
            ? { kind: 'notch', x: t, y: 96, w: len, h: 4 }
            : { kind: 'notch', x: 0, y: t, w: 4, h: len },
    )
  }
  return out
}
