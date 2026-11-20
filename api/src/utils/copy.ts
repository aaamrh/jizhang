/**
 * 会员的对外名称。所有给用户看的文案（接口提示、协议、后台页面）都从这里取，改名只改这一处。
 * 协议原文里写成 {{VIP_NAME}}，渲染时替换。App 端在 app/src/utils/copy.ts 也有一份，改名时两处一起改。
 */
export const VIP_NAME = '大掌柜'

export const withVipName = (s: string) => s.replaceAll('{{VIP_NAME}}', VIP_NAME)
