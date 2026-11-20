import { useEffect } from 'react'
import { STAMP_HOLD_MS, STAMP_PRESS } from '../components/motion'
import { db } from '../db/client'
import { getSetting, setSetting } from '../db/settingsRepo'
import { useUi } from '../store/uiStore'
import { today } from '../utils/dates'
import { milestoneToday } from '../utils/streak'

/**
 * 连续记账跨过关口（7、21、30、100、365 天）的那天，记完那一笔后弹一次庆祝卡片。
 * 等“入账”章落下、开始淡掉再出来；同一个关口只弹一次（记在设置里，换页面、重开 App 都不会再弹）。
 */
export function useStreakMoment(s: { streak: number; todayCounted: boolean }) {
  useEffect(() => {
    const m = milestoneToday(s)
    if (!m) return
    const key = `${today()}:${m.days}`
    if (getSetting(db, 'streakCelebrated') === key) return
    const t = setTimeout(() => {
      setSetting(db, 'streakCelebrated', key)
      useUi.getState().showStreakMoment(m)
    }, STAMP_PRESS.duration + STAMP_HOLD_MS + 400)
    return () => clearTimeout(t)
  }, [s.streak, s.todayCounted]) // eslint-disable-line react-hooks/exhaustive-deps
}
