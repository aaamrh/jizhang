// 安卓桌面小组件的界面（react-native-android-widget 的组件，不是普通 RN 组件）
import { FlexWidget, TextWidget } from 'react-native-android-widget'
import { formatYuan } from '../utils/money'
import type { Snapshot } from './snapshot'

export const ANDROID_WIDGET_NAME = 'Spend'

const PAPER = '#F4EBD9'
const INK = '#2B2118'
const MUTED = '#7A6A58'
const SEAL = '#B5322B'

export function SpendWidget({ todayCents, monthCents }: Snapshot) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`账房：今日已花 ${formatYuan(todayCents)}，本月已花 ${formatYuan(monthCents)}`}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: PAPER, borderRadius: 16, padding: 14, justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="账房" style={{ fontSize: 13, color: SEAL, fontFamily: 'serif' }} />
        <TextWidget text={`本月 ${formatYuan(monthCents)}`} style={{ fontSize: 12, color: MUTED, fontFamily: 'serif' }} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent' }}>
        <TextWidget text="今日已花" style={{ fontSize: 12, color: MUTED, fontFamily: 'serif' }} />
        <TextWidget text={formatYuan(todayCents)} style={{ fontSize: 24, color: INK, fontFamily: 'serif' }} />
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'zhangfang://add' }}
        accessibilityLabel="记一笔"
        style={{ backgroundColor: SEAL, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 }}
      >
        <TextWidget text="记一笔" style={{ fontSize: 14, color: '#FFFFFF', fontFamily: 'serif' }} />
      </FlexWidget>
    </FlexWidget>
  )
}
