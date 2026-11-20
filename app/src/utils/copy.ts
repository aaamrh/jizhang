/**
 * 会员的对外名称。App 里所有给用户看的地方都从这里取，改名只改这一处
 * （服务器端在 api/src/utils/copy.ts 也有一份，改名时一起改）。协议原文里写成 {{VIP_NAME}}，显示时替换。
 */
export const VIP_NAME = '大掌柜'

export const withVipName = (s: string) => s.replaceAll('{{VIP_NAME}}', VIP_NAME)
