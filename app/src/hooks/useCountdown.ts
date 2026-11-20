import { useEffect, useState } from 'react'

/** 发验证码后的倒计时（秒）；left > 0 时按钮不可点 */
export function useCountdown(seconds = 60) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return { left, start: () => setLeft(seconds) }
}
