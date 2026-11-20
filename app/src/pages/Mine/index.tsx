import type { ReactNode } from 'react'
import { Pressable, useWindowDimensions, View } from 'react-native'
import { DateField } from '../../components/DateField'
import { confirm, showAlert } from '../../components/dialogs'
import { FeatureIcon, Icon } from '../../components/Icon'
import { ChevronRight } from '../../components/icons/ui'
import { ListRow } from '../../components/ListRow'
import { Ornament } from '../../components/Ornament'
import { Stat } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { Seal } from '../../components/Seal'
import { Txt } from '../../components/Txt'
import { GoldRing, VipBand, Yaopai } from '../../components/Vip'
import { useGoals, useStreak, useTxnCount } from '../../hooks/data'
import { Plaque, plaqueOf } from '../../components/Plaque'
import { tierOf, tierRank } from '../../utils/goals'
import { enableAppLock } from '../../hooks/useAppLock'
import { appVersion } from '../../hooks/useBootstrap'
import { useAuth } from '../../store/authStore'
import { useSettings } from '../../store/settingsStore'
import { colors, GUTTER, radius, size, space, vip } from '../../theme'
import type { TabProps } from '../../types/navigation'
import { VIP_NAME } from '../../utils/copy'

/** 九宫格入口 */
function Shortcut({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [{ width: '25%', alignItems: 'center', gap: space.xs, paddingVertical: space.sm }, pressed && { opacity: 0.6 }]}
    >
      <FeatureIcon name={glyph} />
      <Txt v="caption">{label}</Txt>
    </Pressable>
  )
}

export default function MinePage({ navigation }: TabProps<'Mine'>) {
  const { reminderEnabled, reminderTime, setReminder, weeklyEnabled, setWeekly, reviewEnabled, setReviewReminder, lockEnabled, setLock, setElderMode } = useSettings()
  const streak = useStreak()
  const txnCount = useTxnCount()
  const achieved = useGoals().filter((g) => g.status === 'achieved')
  // 最气派的一块：档位最高，同档取最近
  const best = [...achieved].sort((a, b) => tierRank(tierOf(b.targetCents)) - tierRank(tierOf(a.targetCents)) || (b.achievedOn ?? '').localeCompare(a.achievedOn ?? ''))[0]
  const { user, syncConsent } = useAuth()
  const { width } = useWindowDimensions()
  const vipSub = !user
    ? '家庭账本：一家人的账汇到一起看'
    : user.isVip
      ? `有效期至 ${user.vipUntil?.slice(0, 10)}`
      : user.vipUntil
        ? '已到期，续费后继续享有'
        : '家庭账本：一家人的账汇到一起看'

  // 返回 false 时开关弹回去
  const toggleReminder = async (on: boolean) => {
    const ok = await setReminder(on)
    if (!ok) showAlert('没有通知权限', '请在系统设置里允许账房发送通知')
    return ok
  }
  const toggleWeekly = async (on: boolean) => {
    const ok = await setWeekly(on)
    if (!ok) showAlert('没有通知权限', '请在系统设置里允许账房发送通知')
    return ok
  }
  const toggleReview = async (on: boolean) => {
    const ok = await setReviewReminder(on)
    if (!ok) showAlert('没有通知权限', '请在系统设置里允许账房发送通知')
    return ok
  }
  const toggleLock = (on: boolean) => (on ? enableAppLock() : (setLock(false), true))
  const elderOn = async () => {
    if (await confirm('开启长辈模式？', '字更大，只留「记一笔」「这个月」两页。\n退出入口在「这个月」页面最下方。', '开启')) setElderMode(true)
  }

  return (
    <Screen edges={['top']}>
      {/* 头像、昵称、登录状态；大掌柜是绛紫雷纹地、金边头像、腰牌 */}
      <ProfileHeader
        vipOn={!!user?.isVip}
        width={width - GUTTER * 2}
        onPress={() => navigation.navigate(user ? 'Account' : 'Login')}
        avatar={<Seal char={user ? Array.from(user.nickname)[0] ?? '账' : '账'} filled />}
        name={user ? user.nickname : '登录 / 注册'}
        sub={user ? (syncConsent ? '云同步已开启' : '云同步未开启，账目只在本机') : '换手机不丢账，还能和家人一起记'}
      />

      <Section>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="连续记账" value={`${streak.streak}`} v="title" />
          <Stat label="最长连续" value={`${streak.longest}`} v="title" />
          <Stat label="记账天数" value={`${streak.total}`} v="title" />
          <Stat label="记账笔数" value={`${txnCount}`} v="title" />
          <Stat label="如愿" value={`${achieved.length}`} v="title" />
        </View>
      </Section>

      <Ornament />

      <Section list>
        <ListRow
          title={user?.isVip ? VIP_NAME : `开通${VIP_NAME}`}
          subtitle={vipSub}
          glyph="ingot"
          iconColor={colors.gold}
          onPress={() => navigation.navigate('Vip')}
        />
      </Section>

      <Section list>
        <ListRow
          title="心愿"
          subtitle={achieved.length ? `已如愿 ${achieved.length} 块匾` : '立个心愿，存满得一块如愿匾'}
          glyph="treasure-bowl"
          iconColor={colors.gold}
          value={best ? <Plaque {...plaqueOf(best)} width={size.plaqueMini} /> : undefined}
          onPress={() => navigation.navigate('Achievements')}
        />
      </Section>

      <Section title="账房">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.md, marginVertical: -space.sm }}>
          <Shortcut glyph="steelyard" label="常记" onPress={() => navigation.navigate('Templates')} />
          <Shortcut glyph="cycle" label="定时记账" onPress={() => navigation.navigate('Recurrings')} />
          <Shortcut glyph="pouch" label="钱袋" onPress={() => navigation.navigate('Wallets')} />
          <Shortcut glyph="lattice-window" label="分类" onPress={() => navigation.navigate('Categories')} />
          <Shortcut glyph="abacus" label="预算" onPress={() => navigation.navigate('Budget')} />
          <Shortcut glyph="thread-book" label="账本" onPress={() => navigation.navigate('Ledgers')} />
          <Shortcut glyph="compass" label="校准余额" onPress={() => navigation.navigate('Calibrate', {})} />
          <Shortcut glyph="letter" label="导出导入" onPress={() => navigation.navigate('Backup')} />
        </View>
      </Section>

      <Section list animateRows title="习惯">
        <ListRow glyph="oil-lamp" title="记账提醒" subtitle="每天定时提醒，当天记过就不提醒" switchValue={reminderEnabled} onSwitch={toggleReminder} />
        {reminderEnabled ? <DateField label="提醒时间" mode="time" value={reminderTime} onChange={(t) => setReminder(true, t)} /> : null}
        <ListRow glyph="scroll" title="每周日看看这周的账" subtitle="周日晚上 8 点提醒，点开是盘账里的这一周" switchValue={weeklyEnabled} onSwitch={toggleWeekly} />
        <ListRow glyph="steelyard" title="每晚提醒细算" subtitle="这个月有还没细算的花销，晚上 8 点提醒一次；桌面图标上显示还有几笔" switchValue={reviewEnabled} onSwitch={toggleReview} />
        <ListRow glyph="lock" title="应用锁" subtitle="打开时需要指纹、面容或手机密码" switchValue={lockEnabled} onSwitch={toggleLock} />
      </Section>

      <Section list>
        <ListRow glyph="longevity-lock" title="长辈模式" subtitle="字更大，只留记一笔和这个月" onPress={elderOn} />
        <ListRow glyph="seal" title="关于与隐私" onPress={() => navigation.navigate('About')} />
        <ListRow glyph="old-key" title="账号与同步" onPress={() => navigation.navigate(user ? 'Account' : 'Login')} />
      </Section>
      <Txt v="caption" faint center>
        账房 v{appVersion()}
      </Txt>
    </Screen>
  )
}

function ProfileHeader(p: { vipOn: boolean; width: number; onPress: () => void; avatar: ReactNode; name: string; sub: string }) {
  const avatar = (
    <View style={{ width: size.avatar, height: size.avatar, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
      {p.avatar}
    </View>
  )
  const row = (
    <Pressable
      accessibilityRole="button"
      onPress={p.onPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: p.vipOn ? space.md : 0 }, pressed && { opacity: 0.7 }]}
    >
      {p.vipOn ? <GoldRing px={size.avatar}>{avatar}</GoldRing> : avatar}
      <View style={{ flex: 1, gap: space.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Txt v="title" numberOfLines={1} color={p.vipOn ? vip.goldLight : undefined} style={{ flexShrink: 1 }}>
            {p.name}
          </Txt>
          {p.vipOn ? <Yaopai dark /> : null}
        </View>
        <Txt v="small" muted={!p.vipOn} color={p.vipOn ? vip.goldLight : undefined} numberOfLines={1} style={p.vipOn ? { opacity: 0.75 } : undefined}>
          {p.sub}
        </Txt>
      </View>
      <Icon as={ChevronRight} color={p.vipOn ? vip.gold : colors.ink3} />
    </Pressable>
  )
  if (!p.vipOn) return row
  return (
    <VipBand width={p.width} height={size.avatar + 8 + space.md * 2}>
      {row}
    </VipBand>
  )
}
