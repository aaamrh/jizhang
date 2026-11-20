import { useLayoutEffect } from 'react'
import { MarkdownDoc } from '../../components/MarkdownDoc'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { PRIVACY_MD, TERMS_MD } from '../../legal/texts'
import { withVipName } from '../../utils/copy'
import type { StackProps } from '../../types/navigation'

/** 用户协议 / 隐私政策：全文，与服务器上的 /terms、/privacy 是同一份原文 */
export default function LegalPage({ navigation, route }: StackProps<'Legal'>) {
  const terms = route.params.kind === 'terms'
  useLayoutEffect(() => navigation.setOptions({ title: terms ? '用户协议' : '隐私政策' }), [navigation, terms])
  return (
    <Screen>
      <Section>
        <MarkdownDoc md={withVipName(terms ? TERMS_MD : PRIVACY_MD)} />
      </Section>
    </Screen>
  )
}
