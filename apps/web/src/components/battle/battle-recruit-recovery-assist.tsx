'use client'

import { useEffect, useRef } from 'react'

const RETRY_DELAYS_MS = [600, 1200, 2200, 4000, 6000] as const

function retryButton(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Retry Recruit turn',
    ) ?? null
  )
}

export function BattleRecruitRecoveryAssist() {
  const retryCount = useRef(0)
  const timer = useRef<number | null>(null)
  const lastVisible = useRef(false)

  useEffect(() => {
    function clearTimer() {
      if (timer.current === null) return
      window.clearTimeout(timer.current)
      timer.current = null
    }

    function sync() {
      const button = retryButton()
      const visible = Boolean(button)

      if (!button) {
        if (lastVisible.current) retryCount.current = 0
        lastVisible.current = false
        clearTimer()
        return
      }

      lastVisible.current = true
      button.hidden = true
      button.setAttribute('aria-hidden', 'true')
      button.tabIndex = -1

      if (timer.current !== null) return
      const delay = RETRY_DELAYS_MS[Math.min(retryCount.current, RETRY_DELAYS_MS.length - 1)]
      timer.current = window.setTimeout(() => {
        timer.current = null
        const current = retryButton()
        if (!current) {
          retryCount.current = 0
          lastVisible.current = false
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
      clearTimer()
    }
  }, [])

  return null
}
