'use client'

import { useLayoutEffect } from 'react'
import { registerBattleEffectKeyboardNavigation } from './battle-effect-keyboard-navigation'

export function registerBattleTabCyclePrevention(
  target: EventTarget,
  ownerDocument?: Document,
): () => void {
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
  const releaseEffects = ownerDocument
    ? registerBattleEffectKeyboardNavigation(target, ownerDocument)
    : undefined
  return () => {
    releaseEffects?.()
    target.removeEventListener('keydown', preventTabCycle, options)
  }
}

export function useBattleTabCyclePrevention(): void {
  useLayoutEffect(() => registerBattleTabCyclePrevention(window, document), [])
}
