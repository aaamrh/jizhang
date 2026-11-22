import type { ReactNode } from 'react'
import { RefreshControl, View } from 'react-native'
import { KeyboardAvoidingView, KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { colors, GUTTER, hairline, space } from '../theme'

interface Props {
  children: ReactNode
  scroll?: boolean
  /** 有导航栏的页面只需让出底部安全区；Tab 页由底栏处理底部，传 ['top'] */
  edges?: Edge[]
  footer?: ReactNode
  /** 拖动排序时临时禁止滚动 */
  scrollEnabled?: boolean
  /** 下拉刷新（如首页下拉同步） */
  refreshing?: boolean
  onRefresh?: () => void
  /** 固定在顶部、不随内容滚动的头部（盘账：账本名、周月年、时间段和收支），边距和流水的头部一样 */
  header?: ReactNode
}

/**
 * 页面骨架：底色、左右 20 边距、组间距 24、安全区、可选底部操作栏。
 * 键盘：安卓全面屏（edge-to-edge）下系统的 adjustResize 不生效，输入框会被输入法挡住；
 * 这里用 keyboard-controller 统一处理——滚动页自动把聚焦的输入框滚到键盘上方，底部操作栏贴着键盘上沿。
 */
export function Screen({ children, scroll = true, edges = ['bottom'], footer, scrollEnabled = true, refreshing, onRefresh, header }: Props) {
  const content = { paddingHorizontal: GUTTER, paddingTop: header ? space.sm : space.md, paddingBottom: space.xxl, gap: space.xl }
  const headerBar = header ? <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xs, paddingBottom: space.xs, gap: space.xs }}>{header}</View> : null
  const footerBar = footer ? (
    <View style={{ paddingHorizontal: GUTTER, paddingVertical: space.sm, backgroundColor: colors.surface, borderTopWidth: hairline, borderColor: colors.hair }}>
      {footer}
    </View>
  ) : null
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={edges}>
      {headerBar}
      {scroll ? (
        <>
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            bottomOffset={space.xl}
            scrollEnabled={scrollEnabled}
            refreshControl={
              onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.active} colors={[colors.active]} /> : undefined
            }
          >
            {children}
          </KeyboardAwareScrollView>
          {footerBar ? <KeyboardStickyView>{footerBar}</KeyboardStickyView> : null}
        </>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={[{ flex: 1 }, content]}>{children}</View>
          {footerBar}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}
