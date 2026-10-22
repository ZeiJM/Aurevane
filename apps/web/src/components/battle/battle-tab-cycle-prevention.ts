'use client'

import { useLayoutEffect } from 'react'
import { registerBattleEffectKeyboardNavigation } from './battle-effect-keyboard-navigation'

export function registerBattleTabCyclePrevention(
  target: EventTarget,
  ownerDocument?: Document,
): () => void {
  let restoreFrame: number | undefined
  const preventTabCycle = (event: Event) => {
    const key = event as KeyboardEvent
    if (
      ownerDocument &&
      (key.code === 'Escape' || key.key === 'Escape') &&
      !key.ctrlKey &&
      !key.altKey &&
      !key.metaKey
    ) {
      // Let readers close first, then release their dormant buttons/scroll lanes.
      const view = ownerDocument.defaultView
      if (restoreFrame !== undefined) view?.cancelAnimationFrame(restoreFrame)
      restoreFrame = view?.requestAnimationFrame(() => {
        restoreFrame = undefined
        if (ownerDocument.querySelector('[role="dialog"], dialog[open], [data-battle-info-panel]'))
          return
        const focus = ownerDocument.activeElement
        if (
          focus instanceof HTMLElement &&
          !focus.isContentEditable &&
          !focus.closest('input, textarea, select, [contenteditable="true"]') &&
          focus.closest('main[data-battle-concept="true"]')
        )
          ownerDocument
            .querySelector<HTMLElement>('main[data-battle-keyboard-focus-root="true"]')
            ?.focus({ preventScroll: true })
      })
    }
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
    if (restoreFrame !== undefined) ownerDocument?.defaultView?.cancelAnimationFrame(restoreFrame)
    releaseEffects?.()
    target.removeEventListener('keydown', preventTabCycle, options)
  }
}

export function useBattleTabCyclePrevention(): void {
  useLayoutEffect(() => registerBattleTabCyclePrevention(window, document), [])
}
