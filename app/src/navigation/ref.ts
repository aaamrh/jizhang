import { createNavigationContainerRef } from '@react-navigation/native'
import type { RootParams } from '../types/navigation'

/** 在页面之外导航（深链、通知点击）用 */
export const navigationRef = createNavigationContainerRef<RootParams>()

let pending: (() => void) | null = null

/** 导航器还没准备好时（冷启动），等 onReady 之后再执行 */
export function whenReady(fn: () => void) {
  if (navigationRef.isReady()) fn()
  else pending = fn
}

export function onNavigationReady() {
  pending?.()
  pending = null
}
