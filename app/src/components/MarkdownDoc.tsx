import { View } from 'react-native'
import { colors, space } from '../theme'
import { Txt } from './Txt'

/** 协议文本的极简渲染：# / ## 标题、> 提示、- 列表、**加粗**、段落（与服务器 /privacy 页同一份原文） */
export function MarkdownDoc({ md }: { md: string }) {
  const inline = (s: string, key: number) =>
    s.split(/(\*\*.+?\*\*)/g).map((part, i) =>
      part.startsWith('**') ? (
        <Txt key={`${key}-${i}`} medium>
          {part.slice(2, -2)}
        </Txt>
      ) : (
        part
      ),
    )
  return (
    <View style={{ gap: space.xs }}>
      {md.split(/\r?\n/).map((raw, i) => {
        const line = raw.trim()
        if (!line) return null
        if (line.startsWith('# ')) return <Txt key={i} v="title">{line.slice(2)}</Txt>
        if (line.startsWith('## ')) return <Txt key={i} v="h2" style={{ marginTop: space.md }}>{line.slice(3)}</Txt>
        if (line.startsWith('> ')) return <Txt key={i} v="small" color={colors.seal}>{line.slice(2)}</Txt>
        if (line.startsWith('- '))
          return (
            <View key={i} style={{ flexDirection: 'row', gap: space.xs, paddingLeft: space.xs }}>
              <Txt>·</Txt>
              <Txt style={{ flex: 1 }}>{inline(line.slice(2), i)}</Txt>
            </View>
          )
        return <Txt key={i}>{inline(line, i)}</Txt>
      })}
    </View>
  )
}
