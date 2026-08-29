'use client'

import { useEffect } from 'react'

export function BattleLessonCoachSemantics() {
  useEffect(() => {
    let frame = 0
    const previousLabels = new Map<HTMLButtonElement, string>()

    const apply = () => {
      frame = 0
      for (const button of document.querySelectorAll<HTMLButtonElement>(
        'button[aria-label="Close victory conditions"]',
      )) {
        if (!previousLabels.has(button)) {
          previousLabels.set(button, button.getAttribute('aria-label') ?? '')
        }
        button.setAttribute('aria-label', 'Close battle objectives dialog')
      }
    }

    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(apply)
    }

    apply()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      for (const [button, label] of previousLabels) {
        if (!button.isConnected) continue
        if (label) button.setAttribute('aria-label', label)
        else button.removeAttribute('aria-label')
      }
    }
  }, [])

  return null
}
