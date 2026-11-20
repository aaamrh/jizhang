import { db } from '../db/client'
import { personalLedger } from '../db/ledgerRepo'
import { spendSnapshot } from '../db/reportRepo'
import { today } from '../utils/dates'

export interface Snapshot {
  day: string
  todayCents: number
  monthCents: number
}

/** 个人账本今日、本月已花。数据库还没建好（装完没打开过 App 就加了小组件）时返回 0 */
export function readSnapshot(): Snapshot {
  const day = today()
  try {
    const p = personalLedger(db)
    return { day, ...(p ? spendSnapshot(db, p.id, day) : { todayCents: 0, monthCents: 0 }) }
  } catch {
    return { day, todayCents: 0, monthCents: 0 }
  }
}
