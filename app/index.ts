import { registerRootComponent } from 'expo'
import { Platform } from 'react-native'
import { registerWidgetTaskHandler } from 'react-native-android-widget'
import App from './src/App'
import { widgetTaskHandler } from './src/widgets/taskHandler'

registerRootComponent(App)
// 安卓桌面小组件：系统要求刷新时调用（App 没运行也会唤起这段 JS）
if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler)
