'use client'

import { useEffect, useRef } from 'react'

import styles from './battle-facing-quick-commit-assist.module.css'

const DOUBLE_TAP_WINDOW_MS = 750

function facingButton(target: EventTarget | null): HTMLButtonElement | null {
  const element = target instanceof Element ? target : null
  return element?.closest<HTMLButtonElement>('button[aria-label^="Face "]') ?? null
}

function clearSelection() {
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    'button[data-facing-quick-selected="true"]',
  )) {
    button.removeAttribute('data-facing-quick-selected')
    button.removeAttribute('aria-pressed')
  }
}

export function BattleFacingQuickCommitAssist() {
  const lastSelection = useRef<{ key: string; at: number } | null>(null)

  useEffect(() => {
    void styles

    function handleClick(event: MouseEvent) {
      const button = facingButton(event.target)
      if (!button || button.disabled) return

      const key = button.getAttribute('aria-label') ?? ''
      const now = Date.now()
      const previous = lastSelection.current
      const sameDirection =
        previous !== null && previous.key === key && now - previous.at <= DOUBLE_TAP_WINDOW_MS

      if (sameDirection) {
        clearSelection()
        lastSelection.current = null
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      clearSelection()
      button.dataset.facingQuickSelected = 'true'
      button.setAttribute('aria-pressed', 'true')
      lastSelection.current = { key, at: now }
    }

    function handlePointerDown(event: PointerEvent) {
      const button = facingButton(event.target)
      if (button) return
      if (!lastSelection.current) return
      clearSelection()
      lastSelection.current = null
    }

    const observer = new MutationObserver(() => {
      if (!document.querySelector('button[aria-label^="Face "]:not(:disabled)')) {
        clearSelection()
        lastSelection.current = null
      }
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    document.addEventListener('click', handleClick, true)
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
      clearSelection()
    }
  }, [])

  return null
}
