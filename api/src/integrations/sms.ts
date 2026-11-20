export interface SmsSender {
  send(phone: string, code: string): Promise<void>
}

/** 开发用：验证码打印到日志，不发短信。接入阿里云/腾讯云时另写一个实现 SmsSender 的类，在 server.ts 换上 */
export class ConsoleSms implements SmsSender {
  constructor(private log: (msg: string) => void = console.warn) {}

  async send(phone: string, code: string) {
    this.log(`[sms:console] ${phone} 验证码 ${code}`)
  }
}
