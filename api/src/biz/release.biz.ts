import type { Models } from '../models/index.js'
import type { ReleaseInput } from '../models/release.model.js'
import type { AppRelease } from '../models/schema.js'
import { AppError } from '../utils/errors.js'
import { compareVersion } from '../utils/version.js'

export type Platform = 'ios' | 'android'

const toDto = (r: AppRelease) => ({
  platform: r.platform,
  latestVersion: r.latestVersion,
  minVersion: r.minVersion,
  notes: r.notes,
  downloadUrl: r.downloadUrl,
  updatedAt: r.updatedAt.toISOString(),
})

export function createReleaseBiz(models: Models) {
  return {
    /** App 启动时调用：低于最低版本 → force，低于最新版本 → optional */
    async checkUpdate(platform: Platform, current: string) {
      const r = await models.releases.find(platform)
      if (!r) return { update: 'none' as const, latest: null, notes: '', downloadUrl: null }
      const update =
        compareVersion(current, r.minVersion) < 0 ? 'force' : compareVersion(current, r.latestVersion) < 0 ? 'optional' : 'none'
      return { update, latest: r.latestVersion, notes: r.notes, downloadUrl: r.downloadUrl }
    },

    async list() {
      return (await models.releases.list()).map(toDto)
    },

    async save(platform: Platform, v: ReleaseInput) {
      if (compareVersion(v.minVersion, v.latestVersion) > 0) {
        throw new AppError(400, 'invalid_input', '最低支持版本不能高于最新版本')
      }
      return toDto(await models.releases.upsert(platform, v))
    },
  }
}
