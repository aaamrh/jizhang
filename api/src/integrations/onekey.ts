/**
 * 本机号码一键登录：App 里的运营商 SDK 拿到 token，服务器用 token 换手机号。
 * 目前没有实现：需要公司开通阿里云号码认证（Dypnsapi GetMobile）后，
 * 用 AccessKey 写一个实现，并在 server.ts 里传入。未传入时接口返回 not_configured。
 */
export interface OnekeyClient {
  getPhone(token: string): Promise<string>
}
