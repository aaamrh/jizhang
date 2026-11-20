import { Pressable, View } from 'react-native'
import { colors, hairline, radius, size, space, tint } from '../theme'
import { Icon } from './Icon'
import { Plus } from './icons/ui'
import { Txt } from './Txt'
import { GoldRing } from './Vip'

/**
 * 家人头像：印章样式的圆，里面是名字的第一个字（“妈妈” → 妈）。
 * 大掌柜外面一圈金边；选中（按人筛选）时墨色实底白字。
 */
export function MemberAvatar({ name, vip, selected, px = size.circle }: { name: string; vip?: boolean; selected?: boolean; px?: number }) {
  const ch = Array.from(name.trim() || '家')[0]
  const body = (
    <View
      style={{
        width: px,
        height: px,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.active : colors.fill,
        borderWidth: hairline * 3,
        borderColor: selected ? colors.active : colors.hair,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt serif allowFontScaling={false} color={selected ? colors.white : colors.ink} style={{ fontSize: px * 0.46, lineHeight: px * 0.62 }}>
        {ch}
      </Txt>
    </View>
  )
  return vip ? <GoldRing px={px}>{body}</GoldRing> : <View style={{ padding: 4 }}>{body}</View>
}

/** 头像 + 名字（+ 金额）的一格，横排成一行用来按人筛选 */
export function MemberPick({
  name,
  sub,
  vip,
  selected,
  onPress,
}: {
  name: string
  sub?: string
  vip?: boolean
  selected?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}${sub ? `，${sub}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [{ alignItems: 'center', width: size.circle + space.xl }, pressed && { opacity: 0.6 }]}
    >
      <MemberAvatar name={name} vip={vip} selected={selected} />
      <Txt v="caption" color={colors.ink} numberOfLines={1}>
        {name}
      </Txt>
      {sub ? (
        <Txt v="caption" faint numberOfLines={1}>
          {sub}
        </Txt>
      ) : null}
    </Pressable>
  )
}

/** 头像那一排最后的“＋邀请”：虚线圆里一个加号，管理员点了发请帖 */
export function InvitePick({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="邀请家人"
      onPress={onPress}
      style={({ pressed }) => [{ alignItems: 'center', width: size.circle + space.xl }, pressed && { opacity: 0.6 }]}
    >
      <View style={{ padding: 4 }}>
        <View
          style={{
            width: size.circle,
            height: size.circle,
            borderRadius: radius.pill,
            borderWidth: hairline * 3,
            borderStyle: 'dashed',
            borderColor: colors.ink3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon as={Plus} size="list" color={colors.ink2} />
        </View>
      </View>
      <Txt v="caption" color={colors.ink2} numberOfLines={1}>
        邀请
      </Txt>
    </Pressable>
  )
}
