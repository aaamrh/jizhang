import { escapeHtml } from './html.js'

/**
 * 协议文本用的极简 Markdown → HTML：只支持 # / ## 标题、> 引用、- 列表、**加粗** 和段落。
 * 先整体转义再加标签，文本里的 < > 不会变成 HTML。
 */
export function markdownToHtml(md: string): string {
  const inline = (s: string) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const out: string[] = []
  let list = false
  const closeList = () => {
    if (list) out.push('</ul>')
    list = false
  }
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      closeList()
      continue
    }
    if (line.startsWith('- ')) {
      if (!list) out.push('<ul>')
      list = true
      out.push(`<li>${inline(line.slice(2))}</li>`)
      continue
    }
    closeList()
    if (line.startsWith('## ')) out.push(`<h2>${inline(line.slice(3))}</h2>`)
    else if (line.startsWith('# ')) out.push(`<h1>${inline(line.slice(2))}</h1>`)
    else if (line.startsWith('> ')) out.push(`<p class="note">${inline(line.slice(2))}</p>`)
    else out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return out.join('\n')
}
