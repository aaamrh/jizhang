import Svg, { Circle, Path } from 'react-native-svg'
import { RETRO_ICONS } from '../assets/icons/retro'
import { ICON_STROKE } from '../theme'

/**
 * 自绘复古图标：24×24 画布，只描边（1.5、圆头圆角）；r ≤ 1 的小圆是实心点。
 * 分类图标、底栏图标都经过这里，换图标来源只改这一个文件。
 */
export function RetroGlyph({ name, color, px }: { name: string; color: string; px: number }) {
  const ic = RETRO_ICONS[name] ?? RETRO_ICONS.misc!
  return (
    <Svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round">
      {ic.paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
      {ic.circles?.map((c, i) => (
        <Circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={c.r <= 1 ? color : 'none'} />
      ))}
    </Svg>
  )
}
