import { useState } from 'react'
import { showAlert } from './dialogs'
import { BackHandler, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PRIVACY_MD, TERMS_MD } from '../legal/texts'
import { colors, GUTTER, iconSize, space } from '../theme'
import { withVipName } from '../utils/copy'
import { Button } from './Button'
import { MarkdownDoc } from './MarkdownDoc'
import { RetroGlyph } from './RetroGlyph'
import { Sheet } from './Sheet'
import { Txt } from './Txt'

const POINTS = [
  '不登录也能用，账只存在这台手机上。',
  '登录并开启同步后，账目和照片通过加密连接存到我们的服务器，用于换手机恢复、多台手机同步和家庭账本。',
  '为了统计有多少人在用、检查新版本、修好出错的地方，账房会上报一个随机生成的安装编号、手机系统、App 版本和出错信息，不含你的账。',
  '相机、相册、通知这些权限，用到的时候才会问你。',
]

/**
 * 第一次打开：先看用户协议和隐私政策，同意后才开始用（同意之前不上报任何东西）。
 * 不同意：安卓上可以直接退出；iOS 不允许 App 自己退出，就停在这里
 */
export function ConsentScreen({ onAgree }: { onAgree: () => void }) {
  const [doc, setDoc] = useState<'terms' | 'privacy' | null>(null)

  const disagree = () =>
    showAlert('不同意就没法使用账房', '账房需要你同意用户协议和隐私政策后才能使用。你可以再看看。', [
      { text: '再看看', style: 'cancel' },
      ...(Platform.OS === 'android' ? [{ text: '退出', style: 'destructive' as const, onPress: () => BackHandler.exitApp() }] : []),
    ])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: GUTTER, gap: space.lg, flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: space.xs }}>
          <RetroGlyph name="thread-book" color={colors.seal} px={iconSize.glyphLg * 2} />
          <Txt v="title" center>
            欢迎使用账房
          </Txt>
        </View>
        <Txt v="small" muted>
          开始之前，请看一看《用户协议》和《隐私政策》。几件要紧的事：
        </Txt>
        <View style={{ gap: space.sm }}>
          {POINTS.map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' }}>
              <RetroGlyph name="chinese-knot" color={colors.seal} px={iconSize.inline} />
              <Txt v="small" style={{ flex: 1 }}>
                {t}
              </Txt>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.md }}>
          <Button title="《用户协议》" variant="ghost" size="sm" onPress={() => setDoc('terms')} />
          <Button title="《隐私政策》" variant="ghost" size="sm" onPress={() => setDoc('privacy')} />
        </View>
        <View style={{ gap: space.sm }}>
          <Button title="同意并开始" variant="primary" onPress={onAgree} />
          <Button title="不同意" variant="ghost" onPress={disagree} />
        </View>
      </ScrollView>
      <Sheet visible={!!doc} onClose={() => setDoc(null)} title={doc === 'terms' ? '用户协议' : '隐私政策'} expandable>
        <View style={{ paddingHorizontal: GUTTER, paddingBottom: space.lg }}>
          {doc ? <MarkdownDoc md={withVipName(doc === 'terms' ? TERMS_MD : PRIVACY_MD)} /> : null}
        </View>
      </Sheet>
    </SafeAreaView>
  )
}
