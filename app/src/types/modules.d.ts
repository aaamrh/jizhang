// drizzle 迁移文件经 babel-plugin-inline-import 内联成字符串
declare module '*.sql' {
  const sql: string
  export default sql
}
