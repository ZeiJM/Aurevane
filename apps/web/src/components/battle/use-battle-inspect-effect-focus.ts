'use client'

import { useId, useLayoutEffect, type RefObject } from 'react'

/** The inspection section is both the initial focus owner and its child readers' portal host. */
export function useBattleInspectEffectFocus(open: boolean, ref: RefObject<HTMLElement | null>) {
  const descriptionId = useId()
  useLayoutEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus({ preventScroll: true })
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true })
      else
        document
          .querySelector<HTMLElement>('main[data-battle-keyboard-focus-root="true"]')
          ?.focus({ preventScroll: true })
    }
  }, [open, ref])
  return descriptionId
}
