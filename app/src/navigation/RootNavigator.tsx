import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { NavBar } from '../components/NavBar'
import AboutPage from '../pages/About'
import AccountPage from '../pages/Account'
import AssetDetailPage from '../pages/AssetDetail'
import AssetFormPage from '../pages/AssetForm'
import AssetSellPage from '../pages/AssetSell'
import AssetsPage from '../pages/Assets'
import BackupPage from '../pages/Backup'
import BudgetPage from '../pages/Budget'
import CalibratePage from '../pages/Calibrate'
import CategoriesPage from '../pages/Categories'
import CategoryFormPage from '../pages/CategoryForm'
import CategoryMergePage from '../pages/CategoryMerge'
import ElderEntryPage from '../pages/ElderEntry'
import ElderHomePage from '../pages/ElderHome'
import EntryEditPage from '../pages/EntryEdit'
import HomePage from '../pages/Home'
import InvitePage from '../pages/Invite'
import JoinPage from '../pages/Join'
import FamilyCreatePage from '../pages/FamilyCreate'
import LedgerDetailPage from '../pages/LedgerDetail'
import LedgersPage from '../pages/Ledgers'
import LegalPage from '../pages/Legal'
import LoginPage from '../pages/Login'
import MinePage from '../pages/Mine'
import ReviewPage from '../pages/Review'
import TemplatesPage from '../pages/Templates'
import TemplateFormPage from '../pages/TemplateForm'
import RecurringsPage from '../pages/Recurrings'
import RecurringFormPage from '../pages/RecurringForm'
import AchievementsPage from '../pages/Achievements'
import GoalFormPage from '../pages/GoalForm'
import GoalFulfillPage from '../pages/GoalFulfill'
import SearchPage from '../pages/Search'
import CalendarPage from '../pages/Calendar'
import TagPage from '../pages/Tag'
import TagsPage from '../pages/Tags'
import StatsPage from '../pages/Stats'
import VipPage from '../pages/Vip'
import WalletFormPage from '../pages/WalletForm'
import WalletsPage from '../pages/Wallets'
import YearReportPage from '../pages/YearReport'
import { useSettings } from '../store/settingsStore'
import { VIP_NAME } from '../utils/copy'
import { colors } from '../theme'
import type { RootParams, TabParams } from '../types/navigation'
import { navigationRef, onNavigationReady } from './ref'
import { TabBar } from './TabBar'

const Stack = createNativeStackNavigator<RootParams>()
const Tab = createBottomTabNavigator<TabParams>()

const theme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.surface, text: colors.ink, border: colors.hair, primary: colors.active },
}

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Home" component={HomePage} />
      <Tab.Screen name="Stats" component={StatsPage} />
      <Tab.Screen name="Assets" component={AssetsPage} />
      <Tab.Screen name="Mine" component={MinePage} />
    </Tab.Navigator>
  )
}

export function RootNavigator() {
  // 长辈模式只有“这个月”和“记一笔”两页；其余页面仍注册着，深链、通知能打开
  const elder = useSettings((s) => s.elderMode)
  return (
    <NavigationContainer theme={theme} ref={navigationRef} onReady={onNavigationReady}>
      <Stack.Navigator
        screenOptions={{
          // 所有二级页面用同一个导航栏：高度、标题字体、返回图标一致
          header: ({ navigation, options, back }) => (
            <NavBar
              title={typeof options.title === 'string' ? options.title : undefined}
              onBack={back ? navigation.goBack : undefined}
              right={options.headerRight?.({ tintColor: colors.ink, canGoBack: !!back })}
            />
          ),
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {elder ? (
          <Stack.Screen name="ElderHome" component={ElderHomePage} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        )}
        <Stack.Screen name="ElderEntry" component={ElderEntryPage} options={{ title: '记一笔', presentation: 'modal' }} />
        <Stack.Screen name="EntryEdit" component={EntryEditPage} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="Review" component={ReviewPage} options={{ title: '复盘' }} />
        <Stack.Screen name="Templates" component={TemplatesPage} options={{ title: '常记' }} />
        <Stack.Screen name="TemplateForm" component={TemplateFormPage} options={{ title: '常记' }} />
        <Stack.Screen name="Recurrings" component={RecurringsPage} options={{ title: '定时记账' }} />
        <Stack.Screen name="RecurringForm" component={RecurringFormPage} options={{ title: '定时记账' }} />
        <Stack.Screen name="Achievements" component={AchievementsPage} options={{ title: '心愿' }} />
        <Stack.Screen name="GoalForm" component={GoalFormPage} options={{ title: '攒钱目标' }} />
        <Stack.Screen name="GoalFulfill" component={GoalFulfillPage} options={{ title: '圆梦' }} />
        <Stack.Screen name="Search" component={SearchPage} options={{ title: '搜索' }} />
        <Stack.Screen name="Calendar" component={CalendarPage} options={{ title: '记账日历' }} />
        <Stack.Screen name="Tag" component={TagPage} options={{ title: '标签' }} />
        <Stack.Screen name="Tags" component={TagsPage} options={{ title: '标签' }} />
        <Stack.Screen name="AssetDetail" component={AssetDetailPage} options={{ title: '家当' }} />
        <Stack.Screen name="AssetForm" component={AssetFormPage} options={{ title: '添加家当' }} />
        <Stack.Screen name="AssetSell" component={AssetSellPage} options={{ title: '卖出' }} />
        <Stack.Screen name="Calibrate" component={CalibratePage} options={{ title: '校准余额' }} />
        <Stack.Screen name="Wallets" component={WalletsPage} options={{ title: '钱袋' }} />
        <Stack.Screen name="WalletForm" component={WalletFormPage} options={{ title: '钱袋' }} />
        <Stack.Screen name="Categories" component={CategoriesPage} options={{ title: '分类' }} />
        <Stack.Screen name="CategoryForm" component={CategoryFormPage} options={{ title: '分类' }} />
        <Stack.Screen name="CategoryMerge" component={CategoryMergePage} options={{ title: '合并到…' }} />
        <Stack.Screen name="Backup" component={BackupPage} options={{ title: '导出与导入' }} />
        <Stack.Screen name="About" component={AboutPage} options={{ title: '关于与隐私' }} />
        <Stack.Screen name="Budget" component={BudgetPage} options={{ title: '预算' }} />
        <Stack.Screen name="YearReport" component={YearReportPage} options={{ title: '年账' }} />
        <Stack.Screen name="Login" component={LoginPage} options={{ title: '登录', presentation: 'modal' }} />
        <Stack.Screen name="Legal" component={LegalPage} />
        <Stack.Screen name="Account" component={AccountPage} options={{ title: '账号与同步' }} />
        <Stack.Screen name="Ledgers" component={LedgersPage} options={{ title: '账本' }} />
        <Stack.Screen name="LedgerDetail" component={LedgerDetailPage} options={{ title: '账本' }} />
        <Stack.Screen name="Invite" component={InvitePage} options={{ title: '邀请家人' }} />
        <Stack.Screen name="Join" component={JoinPage} options={{ title: '加入家庭账本' }} />
        <Stack.Screen name="FamilyCreate" component={FamilyCreatePage} options={{ title: '新建家庭账本' }} />
        <Stack.Screen name="Vip" component={VipPage} options={{ title: VIP_NAME }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
