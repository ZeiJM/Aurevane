'use client'

import { useEffect, useRef } from 'react'

const RETRY_DELAYS_MS = [600, 1200, 2200, 4000, 6000] as const
const RESET_AFTER_STABLE_MS = 10000

function retryButton(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Retry Recruit turn',
    ) ?? null
  )
}

export function BattleRecruitRecoveryAssist() {
  const retryCount = useRef(0)
  const retryTimer = useRef<number | null>(null)
  const resetTimer = useRef<number | null>(null)

  useEffect(() => {
    function clearRetryTimer() {
      if (retryTimer.current === null) return
      window.clearTimeout(retryTimer.current)
      retryTimer.current = null
    }

    function clearResetTimer() {
      if (resetTimer.current === null) return
      window.clearTimeout(resetTimer.current)
      resetTimer.current = null
    }

    function scheduleReset() {
      if (resetTimer.current !== null) return
      resetTimer.current = window.setTimeout(() => {
        resetTimer.current = null
        if (!retryButton()) retryCount.current = 0
      }, RESET_AFTER_STABLE_MS)
    }

    function sync() {
      const button = retryButton()

      if (!button) {
        clearRetryTimer()
        scheduleReset()
        return
      }

      clearResetTimer()
      button.hidden = true
      button.setAttribute('aria-hidden', 'true')
      button.tabIndex = -1

      if (retryTimer.current !== null) return
      const delay = RETRY_DELAYS_MS[Math.min(retryCount.current, RETRY_DELAYS_MS.length - 1)]
      retryTimer.current = window.setTimeout(() => {
        retryTimer.current = null
        const current = retryButton()
        if (!current) {
          scheduleReset()
          return
        }
        retryCount.current += 1
        current.click()
      }, delay)
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      clearRetryTimer()
      clearResetTimer()
    }
  }, [])

  return null
}
