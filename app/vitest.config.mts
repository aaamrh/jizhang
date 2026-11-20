import { defineConfig } from 'vitest/config'

// 只测纯逻辑：utils、mapper、db（用 sql.js 在 Node 里跑同一套 repo 和迁移）
// e2e/：在进程内启动 ../api 的真实后端，测同步（需要先在 api/ 里 npm install）
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'e2e/**/*.test.ts'], environment: 'node' },
})
