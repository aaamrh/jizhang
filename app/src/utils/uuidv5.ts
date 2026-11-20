// uuid v5（RFC 4122）：同一个 namespace + name 永远得到同一个 id。
// 用于默认分类 / 钱袋：id = v5(账本 id, 'expense.dining')，多台手机生成的一致，同步不会重复。
// 纯 JS 实现 SHA-1，不依赖原生模块，手机和 Node 测试都能同步调用。

function sha1(bytes: Uint8Array): Uint8Array {
  const ml = bytes.length * 8
  const withPad = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64)
  withPad.set(bytes)
  withPad[bytes.length] = 0x80
  const view = new DataView(withPad.buffer)
  view.setUint32(withPad.length - 4, ml >>> 0)
  view.setUint32(withPad.length - 8, Math.floor(ml / 2 ** 32))

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0
  const w = new Uint32Array(80)
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n))
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1)
    let a = h0, b = h1, c = h2, d = h3, e = h4
    for (let i = 0; i < 80; i++) {
      const [f, k] =
        i < 20 ? [(b & c) | (~b & d), 0x5a827999]
        : i < 40 ? [b ^ c ^ d, 0x6ed9eba1]
        : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
        : [b ^ c ^ d, 0xca62c1d6]
      const t = (rotl(a, 5) + f + e + k + w[i]!) >>> 0
      e = d
      d = c
      c = rotl(b, 30) >>> 0
      b = a
      a = t
    }
    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }
  const out = new Uint8Array(20)
  const ov = new DataView(out.buffer)
  ;[h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h))
  return out
}

const utf8 = (s: string) => new TextEncoder().encode(s)

function parseUuid(u: string): Uint8Array {
  const hex = u.replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`不是合法的 uuid：${u}`)
  return Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)))
}

export function uuidv5(name: string, namespace: string): string {
  const ns = parseUuid(namespace)
  const n = utf8(name)
  const buf = new Uint8Array(ns.length + n.length)
  buf.set(ns)
  buf.set(n, ns.length)
  const h = sha1(buf).slice(0, 16)
  h[6] = (h[6]! & 0x0f) | 0x50 // version 5
  h[8] = (h[8]! & 0x3f) | 0x80 // RFC 4122 variant
  const hex = Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
