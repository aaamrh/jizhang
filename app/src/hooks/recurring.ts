import { AppState } from 'react-native'
import { recurringActions } from './actions'

/** 周期记账：打开 App、回到前台时把到日子的账补记上（跨过零点后回到前台也会记当天的） */
export function startRecurring() {
  const run = () => {
    try {
      recurringActions.runDue()
    } catch {
      // 数据库忙或别的意外：下次回到前台再试，不打扰用户
    }
  }
  run()
  const sub = AppState.addEventListener('change', (s) => s === 'active' && run())
  return () => sub.remove()
}
