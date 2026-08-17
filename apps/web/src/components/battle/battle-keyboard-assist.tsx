'use client'

import { useEffect, useRef } from 'react'

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function attackModeIsActive(): boolean {
  const instruction = document.querySelector<HTMLElement>('[data-testid="combat-mode-instruction"]')
  return instruction?.textContent?.startsWith('ACT · Choose an enemy') ?? false
}

function legalVisibleTargetButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).filter((button) => !button.disabled && !button.getAttribute('aria-label')?.includes('Wayfarer'))
}

export function BattleKeyboardAssist() {
  const targetIndex = useRef(-1)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target)) return

      if (event.key === 'l' || event.key === 'L') {
        event.preventDefault()
        window.dispatchEvent(new Event('aurevane:battle-log-toggle'))
        return
      }

      if (event.key !== 'Tab' || !attackModeIsActive()) return

      const targets = legalVisibleTargetButtons()
      if (targets.length === 0) return

      event.preventDefault()
      const direction = event.shiftKey ? -1 : 1
      targetIndex.current =
        targetIndex.current < 0
          ? event.shiftKey
            ? targets.length - 1
            : 0
          : (targetIndex.current + direction + targets.length) % targets.length

      const target = targets[targetIndex.current]
      target?.focus()
      target?.click()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return null
}
