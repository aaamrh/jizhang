import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PRIVACY_MD, TERMS_MD } from './texts'

// App 内显示的协议必须和服务器 /privacy、/terms 一字不差
describe('协议文本与 api/legal 一致', () => {
  const read = (n: string) => readFileSync(new URL(`../../../api/legal/${n}.md`, import.meta.url), 'utf8')
  it('隐私政策', () => expect(PRIVACY_MD).toBe(read('privacy')))
  it('用户协议', () => expect(TERMS_MD).toBe(read('terms')))
})
