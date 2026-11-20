/** 数据库里是普通字符串，转成联合类型；不认识的值用 fallback，避免脏数据（比如导入的文件）让界面崩溃 */
export function oneOf<T extends string>(v: string | null | undefined, list: readonly T[], fallback: T): T {
  return list.includes(v as T) ? (v as T) : fallback
}

export function oneOfOrNull<T extends string>(v: string | null | undefined, list: readonly T[]): T | null {
  return list.includes(v as T) ? (v as T) : null
}
