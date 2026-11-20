import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { readSnapshot } from './snapshot'
import { SpendWidget } from './SpendWidget'

/** 安卓系统要求刷新小组件时（添加、定时更新、改大小）调用；App 没在运行时也会被唤起 */
export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return
  renderWidget(<SpendWidget {...readSnapshot()} />)
}
