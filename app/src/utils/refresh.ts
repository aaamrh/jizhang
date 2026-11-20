/**
 * 下拉刷新的执行器（纯逻辑，可测）。之前首页的转圈会卡住，两个原因：
 * 1) refreshing 直接绑在“是否在同步”上，同步太快时 true→false 在同一帧里合并，RefreshControl 收不到变化，安卓上转圈停不下来；
 * 2) 同步卡住（网络慢）时永远不结束。
 * 这里：先置 true，任务结束或超时（取先到者）后至少再保持 minMs，再在 finally 里置 false——任何情况下都会收回。
 */
export async function runRefresh(
  task: () => Promise<unknown>,
  setRefreshing: (v: boolean) => void,
  { minMs = 600, timeoutMs = 15_000 }: { minMs?: number; timeoutMs?: number } = {},
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => number = Date.now,
) {
  setRefreshing(true)
  const started = now()
  try {
    await Promise.race([Promise.resolve().then(task).catch(() => {}), sleep(timeoutMs)])
  } finally {
    const left = minMs - (now() - started)
    if (left > 0) await sleep(left)
    setRefreshing(false)
  }
}
