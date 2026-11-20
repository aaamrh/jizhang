import { randomInt } from 'node:crypto'

// 去掉容易念错、看错的 0/O、1/I/L
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** 邀请码：8 位，读出来不会混淆 */
export const inviteCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

/** 新用户默认昵称：账友 + 4 位数字 */
export const defaultNickname = () => `账友${String(randomInt(10000)).padStart(4, '0')}`
