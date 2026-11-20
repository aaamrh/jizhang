import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { markdownToHtml } from '../src/utils/markdown.js'
import { makeApp, type TestApp } from './helpers.js'

let t: TestApp
beforeAll(async () => { t = await makeApp() })
afterAll(() => t.close())

describe('协议页', () => {
  it('GET /privacy、/terms 返回 HTML，含草稿提示和联系方式占位', async () => {
    for (const [path, title] of [['/privacy', '账房隐私政策'], ['/terms', '账房用户协议']]) {
      const r = await t.call('GET', path!)
      expect(r.status).toBe(200)
      expect(r.body).toContain(`<h1>${title}</h1>`)
      expect(r.body).toContain('草稿，上线前须法务审核')
      expect(r.body).toContain('【联系邮箱】')
    }
  })

  it('markdown 转换：标题、列表、加粗，且转义 HTML', () => {
    expect(markdownToHtml('# 标题\n\n- 一\n- **二**\n\n<b>x</b>')).toBe('<h1>标题</h1>\n<ul>\n<li>一</li>\n<li><strong>二</strong></li>\n</ul>\n<p>&lt;b&gt;x&lt;/b&gt;</p>')
  })
})
