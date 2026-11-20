import { Component, type ReactNode } from 'react'
import { View } from 'react-native'
import { recordError } from '../hooks/errorReport'
import { colors, space } from '../theme'
import { Button } from './Button'
import { EmptyState } from './Misc'

/**
 * 页面出错时的兜底：不白屏，记下出错信息（同意隐私政策后上报），给一个“回到首页”。
 * 回到首页 = 把里面整棵重新挂载，导航回到起始页
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; round: number }> {
  state = { failed: false, round: 0 }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    recordError(error, false, info.componentStack ?? '')
  }

  render() {
    if (!this.state.failed) return <View key={this.state.round} style={{ flex: 1 }}>{this.props.children}</View>
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, backgroundColor: colors.bg }}>
        <EmptyState
          glyph="misc"
          text={'这里出了点问题。\n你的账都在，没有丢；问题已经记下了，我们会尽快修好。'}
          action={<Button title="回到首页" variant="primary" onPress={() => this.setState((s) => ({ failed: false, round: s.round + 1 }))} />}
        />
      </View>
    )
  }
}
