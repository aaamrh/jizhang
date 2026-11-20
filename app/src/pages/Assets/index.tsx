import { useState } from 'react'
import { View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Button } from '../../components/Button'
import { Segmented } from '../../components/Chip'
import { AssetCard } from '../../components/AssetCard'
import { itemIn, itemLayout, itemOut } from '../../components/motion'
import { Plus } from '../../components/icons/ui'
import { EmptyState, Stat } from '../../components/Misc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { useAssets } from '../../hooks/data'
import { space } from '../../theme'
import type { TabProps } from '../../types/navigation'
import { assetCost } from '../../utils/assetCost'
import { today } from '../../utils/dates'
import { formatPlain } from '../../utils/money'

// 两列之间留约 3% 的空隙（宽度按百分比算，适配不同屏幕）
const GRID_GAP_PCT = 1.5

export default function AssetsPage({ navigation }: TabProps<'Assets'>) {
  const [tab, setTab] = useState<'holding' | 'ended'>('holding')
  const all = useAssets()
  const holding = all.filter((a) => a.status === 'holding')
  const list = tab === 'holding' ? holding : all.filter((a) => a.status !== 'holding')
  const holdingTotal = holding.reduce((n, a) => n + a.costCents, 0)
  const perDay = holding.reduce((n, a) => n + assetCost(a, today()).perDayCents, 0)
  return (
    <Screen edges={['top']}>
      <Section>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="持有中" value={`${holding.length} 件`} />
          <Stat label="买入共" value={formatPlain(holdingTotal)} />
          <Stat label="每天合计" value={formatPlain(perDay)} />
        </View>
      </Section>

      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Segmented
              options={[
                { value: 'holding', label: '持有中' },
                { value: 'ended', label: '已出手' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>
          <Button title="添加" icon={Plus} size="sm" onPress={() => navigation.navigate('AssetForm', {})} />
        </View>
        {list.length === 0 ? (
          <EmptyState
            glyph="tab-chest"
            text={tab === 'holding' ? '记下买过的东西，看看每天花多少、值不值。\n记支出时勾上「家当」，或在这里添加已有的东西。' : '还没有卖出、丢失或损坏的东西'}
          />
        ) : (
          // 两列宫格；切换“持有中/已出手”时卡片淡入、重新排位
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md }}>
            {list.map((a) => (
              <Animated.View key={a.id} entering={itemIn} exiting={itemOut} layout={itemLayout} style={{ width: `${50 - GRID_GAP_PCT}%` }}>
                <AssetCard a={a} onPress={() => navigation.navigate('AssetDetail', { id: a.id })} />
              </Animated.View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  )
}
