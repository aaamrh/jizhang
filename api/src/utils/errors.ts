/** biz 层抛出的业务错误，由 plugins/errors.ts 统一转成 HTTP 响应 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
