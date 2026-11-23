'use client'

import { BATTLE_MOBILE_LAYOUT_QUERY } from './battle-responsive-layout'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Scroll only the lower reader: battle geometry and the collapse control stay in place. */
export function useBattleMobileChronicle() {
  const [chronicleOpen, setChronicleOpen] = useState(false)
  const lowerPanelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const panel = lowerPanelRef.current
    if (!panel || !window.matchMedia(BATTLE_MOBILE_LAYOUT_QUERY).matches) return
    const chronicle = panel.querySelector<HTMLElement>('[data-battle-side="selected"]')
    panel.scrollTo({
      top:
        chronicleOpen && chronicle
          ? panel.scrollTop +
            chronicle.getBoundingClientRect().top -
            panel.getBoundingClientRect().top
          : 0,
      behavior: 'instant',
    })
  }, [chronicleOpen])

  useEffect(() => {
    function toggle() {
      if (window.matchMedia(BATTLE_MOBILE_LAYOUT_QUERY).matches) setChronicleOpen((open) => !open)
    }
    window.addEventListener('aurevane:battle-log-toggle', toggle)
    return () => window.removeEventListener('aurevane:battle-log-toggle', toggle)
  }, [])

  return { chronicleOpen, lowerPanelRef, toggleChronicle: () => setChronicleOpen((open) => !open) }
}
