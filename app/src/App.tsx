import { useFonts } from 'expo-font'
import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ActionSheet, DialogHost, LockOverlay, ReminderAsk, StampOverlay, StreakMomentOverlay, Toast, UpdateDialog } from './components/Overlays'
import { VipSheet } from './components/VipSheet'
import { GoalCelebration } from './components/GoalCelebration'
import { ConsentScreen } from './components/ConsentScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Txt } from './components/Txt'
import { useGoals } from './hooks/data'
import { useAppLockWatcher } from './hooks/useAppLock'
import { checkPendingOrder } from './hooks/account'
import { startNotificationSync } from './hooks/notifications'
import { startRecurring } from './hooks/recurring'
import { startSync } from './hooks/sync'
import { installGlobalErrorHandler } from './hooks/errorReport'
import { phoneHome, useBootstrap } from './hooks/useBootstrap'
import { useSettings } from './store/settingsStore'
import { RootNavigator } from './navigation/RootNavigator'
import { useExternalRoutes } from './navigation/useExternalRoutes'
import { colors, SERIF } from './theme'
import { startWidgetSync } from './widgets/sync'

// 闪退前先把出错信息记下来（同意隐私政策后再上报）
installGlobalErrorHandler()

// App 在前台时也显示记账提醒
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
})

export default function App() {
  // 霞鹜文楷 Lite（SIL OFL 1.1，许可证见 assets/fonts/OFL.txt）：只用于标题、月份、金额
  const [fontsLoaded] = useFonts({ [SERIF]: require('../assets/fonts/LXGWWenKaiLite-Regular.ttf') })
  const { ready, error } = useBootstrap()
  const privacyAgreed = useSettings((s) => s.privacyAgreed)
  useAppLockWatcher()
  useExternalRoutes()

  // 数据库就绪后：按“今天记没记”重排提醒、刷新桌面小组件、登录后开始同步（回到前台时顺便查待确认的订单）
  useEffect(() => {
    if (!ready || !privacyAgreed) return
    const stopRecurring = startRecurring() // 先补记周期账，提醒再按“今天记没记”重排
    const stopNotifications = startNotificationSync()
    const stopWidgets = startWidgetSync()
    const stopSync = startSync(() => void checkPendingOrder())
    void checkPendingOrder()
    return () => {
      stopRecurring()
      stopNotifications()
      stopWidgets()
      stopSync()
    }
  }, [ready, privacyAgreed])

  if (error) {
    // 升级在一个事务里，出错整体回滚；升级前还备份过一份（db-backups/）
    return (
      <View style={s.center}>
        <Txt center>账本没能打开。你的账都还在，没有被改动。</Txt>
        <Txt v="small" muted center>
          请把账房更新到最新版本再打开；还是不行的话请联系我们，并附上这句：{error.message}
        </Txt>
      </View>
    )
  }
  if (!fontsLoaded || !ready) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.seal} />
      </View>
    )
  }
  if (!privacyAgreed) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <StatusBar style="dark" />
            <ConsentScreen
              onAgree={() => {
                useSettings.getState().agreePrivacy()
                void phoneHome()
              }}
            />
            <DialogHost />
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    )
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <KeyboardProvider>
      <StatusBar style="dark" />
      <ErrorBoundary>
        <RootNavigator />
      </ErrorBoundary>
      <UpdateDialog />
      <ReminderAsk />
      <Toast />
      <StampOverlay />
      <StreakMomentOverlay />
      <VipSheet />
      <CelebrationHost />
      <ActionSheet />
      <DialogHost />
      <LockOverlay />
      </KeyboardProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

/** 攒钱目标达成时弹出牌匾（数据库就绪后才挂载） */
function CelebrationHost() {
  return <GoalCelebration goals={useGoals()} />
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
})
