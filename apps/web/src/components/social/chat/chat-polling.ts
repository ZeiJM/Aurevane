/** Chat has no background delivery requirement; catch up when its tab becomes visible. */
export function startVisibleChatPolling(load: () => Promise<void>, intervalMs: number): () => void {
  let disposed = false
  let pending = false
  let timer: number | null = null
  let failures = 0
  let retryAt = 0

  const clearTimer = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
  }
  const schedule = (delay: number) => {
    clearTimer()
    if (!disposed && document.visibilityState === 'visible') {
      timer = window.setTimeout(() => void poll(), delay)
    }
  }
  const poll = async () => {
    clearTimer()
    if (disposed || pending || document.visibilityState !== 'visible') return
    if (Date.now() < retryAt) {
      schedule(retryAt - Date.now())
      return
    }
    pending = true
    try {
      await load()
      failures = 0
      retryAt = 0
    } catch {
      failures = Math.min(failures + 1, 6)
      retryAt = Date.now() + Math.min(60_000, intervalMs * 2 ** failures)
    } finally {
      pending = false
      schedule(retryAt ? Math.max(0, retryAt - Date.now()) : intervalMs)
    }
  }
  const onVisibility = () => {
    clearTimer()
    if (document.visibilityState === 'visible') void poll()
  }
  document.addEventListener('visibilitychange', onVisibility)
  void poll()

  return () => {
    disposed = true
    clearTimer()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
