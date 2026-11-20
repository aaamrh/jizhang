import type { LucideIcon } from 'lucide-react-native'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { colors, hairline, radius, size as sizes, space } from '../theme'
import { Icon } from './Icon'
import { Txt, useFontScale } from './Txt'

// primary 朱红（每页主按钮）；ink 墨色（弹窗里的普通确认，朱红留给危险操作以外的主按钮和“记”）；danger 红字（删除这类）
export type ButtonVariant = 'primary' | 'ink' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'lg' | 'md' | 'sm'

interface Props {
  title: string
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  disabled?: boolean
  /** 占满一行 */
  block?: boolean
  style?: ViewStyle
  /** 按住这么久（毫秒）才生效，红色像印泥一样从左铺满；松手就取消。只给回不去的操作（注销、解散、覆盖导入） */
  holdMs?: number
}

const HEIGHT = { lg: sizes.buttonLg, md: sizes.buttonMd, sm: sizes.buttonSm }
const PAD = { lg: space.lg, md: space.md, sm: space.sm }

const FG: Record<ButtonVariant, string> = {
  primary: colors.white,
  ink: colors.white,
  secondary: colors.ink,
  ghost: colors.seal,
  danger: colors.seal,
}

const BG: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.seal },
  ink: { backgroundColor: colors.active },
  secondary: { backgroundColor: colors.surface, borderWidth: hairline, borderColor: colors.hair },
  ghost: {},
  danger: { backgroundColor: colors.surface, borderWidth: hairline, borderColor: colors.hair },
}

/** 唯一的按钮组件：5 种样式 × 3 种尺寸，内边距和圆角统一 */
export function Button({ title, onPress, variant = 'secondary', size = 'lg', icon, disabled, block, style, holdMs }: Props) {
  const scale = useFontScale()
  const fg = FG[variant]
  const hold = useSharedValue(0)
  const fire = () => {
    hold.value = 0
    onPress()
  }
  const fill = useAnimatedStyle(() => ({ width: `${hold.value * 100}%` }))
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      // 读屏时按不住：双击直接生效（弹窗本身已经说清楚了）
      accessibilityHint={holdMs ? '按住约一秒半' : undefined}
      accessibilityActions={holdMs ? [{ name: 'activate' }] : undefined}
      onAccessibilityAction={holdMs ? onPress : undefined}
      disabled={disabled}
      onPress={holdMs ? undefined : onPress}
      onPressIn={holdMs ? () => (hold.value = withTiming(1, { duration: holdMs, easing: Easing.linear }, (done) => done && runOnJS(fire)())) : undefined}
      onPressOut={holdMs ? () => hold.value < 1 && (hold.value = withTiming(0, { duration: 150 })) : undefined}
      style={({ pressed }) => [
        {
          minHeight: HEIGHT[size] * scale,
          paddingHorizontal: variant === 'ghost' ? space.xs : PAD[size],
          borderRadius: size === 'sm' ? radius.sm : radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: block ? 'stretch' : 'auto',
        },
        BG[variant],
        pressed && !holdMs && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
        holdMs ? { overflow: 'hidden' } : null,
        style,
      ]}
    >
      {holdMs ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { right: undefined, backgroundColor: colors.seal, opacity: 0.22 }, fill]} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {icon ? <Icon as={icon} size={size === 'sm' ? 'inline' : 'list'} color={fg} /> : null}
        <Txt v={size === 'sm' ? 'small' : 'body'} color={fg} medium>
          {title}
        </Txt>
      </View>
    </Pressable>
  )
}
