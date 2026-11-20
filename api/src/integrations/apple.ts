import { createRemoteJWKSet, jwtVerify } from 'jose'

export interface AppleVerifier {
  /** 校验 Sign in with Apple 的 identityToken，返回 Apple 用户 id（sub）；失败抛错 */
  verify(identityToken: string): Promise<string>
}

/** 未配置 APPLE_BUNDLE_ID 时返回 null，由 biz 层报 not_configured */
export function createAppleVerifier(bundleId?: string): AppleVerifier | null {
  if (!bundleId) return null
  const jwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'))
  return {
    async verify(identityToken) {
      const { payload } = await jwtVerify(identityToken, jwks, {
        issuer: 'https://appleid.apple.com',
        audience: bundleId,
      })
      if (!payload.sub) throw new Error('apple token without sub')
      return payload.sub
    },
  }
}
