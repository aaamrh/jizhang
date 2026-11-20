import { eq } from 'drizzle-orm'
import type { DB } from './index.js'
import { appReleases } from './schema.js'

export type ReleaseInput = { latestVersion: string; minVersion: string; notes: string; downloadUrl: string | null }

export const releaseModel = (db: DB) => ({
  async find(platform: string) {
    return (await db.select().from(appReleases).where(eq(appReleases.platform, platform)).limit(1))[0]
  },

  async list() {
    return db.select().from(appReleases)
  },

  async upsert(platform: string, v: ReleaseInput) {
    const set = { ...v, updatedAt: new Date() }
    const rows = await db
      .insert(appReleases)
      .values({ platform, ...set })
      .onConflictDoUpdate({ target: appReleases.platform, set })
      .returning()
    return rows[0]!
  },
})
