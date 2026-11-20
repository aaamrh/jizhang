import { describe, expect, it } from 'vitest'
import type { Member } from '../types/domain'
import { ledgerCover } from './ledgerCover'
import { recordedBy, recordedSpend, whoLabel, whoRecorded } from './members'

const m = (id: string, userId: string | null, extra: Partial<Member> = {}): Member => ({
  id,
  ledgerId: 'L',
  userId,
  nickname: id,
  role: userId ? 'member' : 'profile',
  elderMode: false,
  isMe: false,
  removed: false,
  isVip: false,
  ...extra,
})

describe('家庭账本：谁记的', () => {
  const members = [m('old-me', 'u1', { removed: true }), m('mom', null), m('me', 'u1'), m('dad', 'u2')]

  it('按记账人算；同一个人有旧行时优先在册的行；旧账标过“谁花的”也按记账人', () => {
    expect(whoRecorded({ createdBy: 'u1' }, members)?.id).toBe('me')
    expect(whoRecorded({ createdBy: null }, members)).toBeNull()
    expect(whoLabel({ createdBy: 'u9' }, members)).toBe('已离开的成员')
  })

  it('每人记了多少支出：退款冲减，收入、转账不算；按人筛选', () => {
    const items = [
      { type: 'expense', amountCents: 3600, memberId: 'mom', createdBy: 'u2' },
      { type: 'expense', amountCents: 1000, createdBy: 'u1' },
      { type: 'refund', amountCents: 600, createdBy: 'u2' },
      { type: 'income', amountCents: 99999, createdBy: 'u2' },
      { type: 'transfer', amountCents: 500, createdBy: 'u1' },
      { type: 'expense', amountCents: 200, createdBy: null },
    ]
    const s = recordedSpend(items, members)
    expect(s.get('dad')).toBe(3000)
    expect(s.get('me')).toBe(1000)
    expect(s.get('mom')).toBeUndefined()
    expect(s.get('')).toBe(200)
    expect(recordedBy(items[1]!, 'me', members)).toBe(true)
    expect(recordedBy(items[0]!, 'me', members)).toBe(false)
  })
})

describe('账本封面', () => {
  it('没选封面、或是旧版本存的图标名，按类型给默认纸色', () => {
    expect(ledgerCover({ type: 'family', cover: null })).toBe('songlv')
    expect(ledgerCover({ type: 'family', cover: 'lantern' })).toBe('songlv')
    expect(ledgerCover({ type: 'personal', cover: null })).toBe('dianlan')
  })
  it('选了纸色就用选的', () => {
    expect(ledgerCover({ type: 'family', cover: 'ouhe' })).toBe('ouhe')
  })
})
