import { View } from 'react-native'
import { ListRow } from '../../components/ListRow'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Seal } from '../../components/Seal'
import { Txt } from '../../components/Txt'
import { appVersion } from '../../hooks/useBootstrap'
import { size, space } from '../../theme'
import type { StackProps } from '../../types/navigation'
import { VIP_NAME } from '../../utils/copy'

// 隐私政策、用户协议全文是草稿，正式上线前需由法务定稿（原文在 api/legal）
export default function AboutPage({ navigation }: StackProps<'About'>) {
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.md }}>
        <Seal char="账" px={size.sealLg} filled />
        <Txt v="title">账房</Txt>
        <Txt v="small" muted>
          v{appVersion()}
        </Txt>
      </View>
      <Section title="你的账目在哪里">
        <Txt>不登录时，记的每一笔账、钱袋、家当都只存在这台手机上。换手机时请用「导出与导入」。</Txt>
        <Txt>
          登录并同意开启云同步后，账目会加密传输并保存在账房的服务器上，用于换手机恢复和家庭账本共享。后台管理人员看不到账目内容。可以随时注销账号删除云端数据。
        </Txt>
      </Section>
      <Section title="我们收集什么">
        <Txt>为了统计有多少人在用、提醒你更新版本，App 每次启动会发送：一个随机生成的安装编号、手机系统（iOS 或安卓）、账房的版本号。</Txt>
        <Txt>登录后还会附带你的账号编号；账号本身保存登录方式（手机号、微信或 Apple 的用户标识）、昵称和{VIP_NAME}状态。</Txt>
      </Section>
      <Section list>
        <ListRow title="隐私政策" onPress={() => navigation.navigate('Legal', { kind: 'privacy' })} />
        <ListRow title="用户协议" onPress={() => navigation.navigate('Legal', { kind: 'terms' })} />
      </Section>
    </Screen>
  )
}
