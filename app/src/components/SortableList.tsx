import { useRef, useState, type ReactNode } from 'react'
import { Animated, PanResponder, View, type PanResponderInstance } from 'react-native'
import { colors, hairline, shadowRaised, size, space } from '../theme'
import { Icon } from './Icon'
import { Ellipsis } from './icons/ui'

const ROW_H = size.row

interface Props<T> {
  items: T[]
  keyOf: (t: T) => string
  render: (t: T) => ReactNode
  /** 松手后回调新的顺序 */
  onReorder: (items: T[]) => void
  /** 拖动期间外层应禁止滚动 */
  onDragging?: (dragging: boolean) => void
}

/**
 * 按住右侧“≡”上下拖动排序。行高固定，用 RN 自带的 PanResponder，不引入手势库。
 * shortcut: 列表比屏幕长时拖到边缘不会自动滚动；分类一般 30 个以内，够用
 */
export function SortableList<T>({ items, keyOf, render, onReorder, onDragging }: Props<T>) {
  const [order, setOrder] = useState(items)
  const [drag, setDrag] = useState<{ key: string; to: number } | null>(null)
  const dy = useRef(new Animated.Value(0)).current

  // 外部数据变化（新增、改名）时同步；拖动中不打断
  if (!drag && (order.length !== items.length || order.some((x, i) => x !== items[i]))) setOrder(items)

  // 回调里读最新值，PanResponder 每个 key 只建一次，拖动中重渲染不会丢手势
  const latest = useRef({ order, keyOf, onReorder, onDragging, from: 0, to: 0 })
  latest.current = { ...latest.current, order, keyOf, onReorder, onDragging }
  const responders = useRef(new Map<string, PanResponderInstance>()).current

  const finish = () => {
    const l = latest.current
    const next = [...l.order]
    const [moved] = next.splice(l.from, 1)
    next.splice(l.to, 0, moved!)
    dy.setValue(0)
    setDrag(null)
    setOrder(next)
    l.onDragging?.(false)
    if (l.from !== l.to) l.onReorder(next)
  }

  const responderFor = (key: string) => {
    let r = responders.get(key)
    if (!r) {
      r = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const l = latest.current
          l.from = l.to = l.order.findIndex((x) => l.keyOf(x) === key)
          dy.setValue(0)
          setDrag({ key, to: l.from })
          l.onDragging?.(true)
        },
        onPanResponderMove: (_e, g) => {
          const l = latest.current
          dy.setValue(g.dy)
          const to = Math.max(0, Math.min(l.order.length - 1, l.from + Math.round(g.dy / ROW_H)))
          if (to !== l.to) {
            l.to = to
            setDrag({ key, to })
          }
        },
        onPanResponderRelease: finish,
        onPanResponderTerminate: finish,
      })
      responders.set(key, r)
    }
    return r
  }

  return (
    <View>
      {order.map((item, i) => {
        const key = keyOf(item)
        const dragging = drag?.key === key
        // 拖动时，被跨过的行让出位置
        const from = drag ? order.findIndex((x) => keyOf(x) === drag.key) : -1
        const shift = drag && !dragging ? (from < i && i <= drag.to ? -ROW_H : drag.to <= i && i < from ? ROW_H : 0) : 0
        return (
          <Animated.View
            key={key}
            style={[
              {
                height: ROW_H,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderTopWidth: i > 0 ? hairline : 0,
                borderColor: colors.hair,
              },
              dragging && [{ zIndex: 10 }, shadowRaised],
              { transform: [{ translateY: dragging ? dy : shift }] },
            ]}
          >
            <View style={{ flex: 1 }}>{render(item)}</View>
            <View
              {...responderFor(key).panHandlers}
              accessibilityLabel="按住拖动排序"
              style={{ width: size.buttonLg, height: '100%', alignItems: 'center', justifyContent: 'center', paddingRight: space.xs }}
            >
              <Icon as={Ellipsis} color={colors.ink3} />
            </View>
          </Animated.View>
        )
      })}
    </View>
  )
}
