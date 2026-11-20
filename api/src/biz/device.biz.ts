import type { Models } from '../models/index.js'

export function createDeviceBiz(models: Models) {
  return {
    ping: (v: { deviceId: string; platform: string; appVersion: string }, userId: string | null) =>
      models.devices.upsertPing({ id: v.deviceId, platform: v.platform, appVersion: v.appVersion, userId }),

    /** App 出错上报（同意隐私政策后才会发）：只存出错信息，不关联账号 */
    reportErrors: (
      v: { deviceId: string; platform: string; appVersion: string; reports: { message: string; stack: string; fatal: boolean; at: number }[] },
    ) =>
      models.devices.insertErrors(
        v.reports.map((r) => ({
          deviceId: v.deviceId,
          platform: v.platform,
          appVersion: v.appVersion,
          message: r.message,
          stack: r.stack,
          fatal: r.fatal,
          occurredAt: new Date(r.at),
        })),
      ),

    recentErrors: async () =>
      (await models.devices.recentErrors(200)).map((e) => ({
        ...e,
        occurredAt: e.occurredAt.toISOString(),
        createdAt: e.createdAt.toISOString(),
      })),
  }
}
