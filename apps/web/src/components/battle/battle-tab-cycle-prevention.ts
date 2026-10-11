'use client'

import { useLayoutEffect } from 'react'

export function registerBattleTabCyclePrevention(target: EventTarget): () => void {
  const preventTabCycle = (event: Event) => {
    const key = event as KeyboardEvent
    if ((key.code !== 'Tab' && key.key !== 'Tab') || key.ctrlKey || key.altKey || key.metaKey)
      return
    event.preventDefault()
    // Tab never reaches a configured battle shortcut or a control's local key handler.
    event.stopImmediatePropagation()
  }
  const options = { capture: true }
  target.addEventListener('keydown', preventTabCycle, options)
  return () => target.removeEventListener('keydown', preventTabCycle, options)
}

export function useBattleTabCyclePrevention(): void {
  useLayoutEffect(() => registerBattleTabCyclePrevention(window), [])
}
