'use client'

import { useEffect } from 'react'

function hideLegacyResultOverlay(): void {
  const legacyResult = document.querySelector<HTMLElement>(
    'section[aria-labelledby="pvp-result-title"]',
  )
  const backdrop = legacyResult?.parentElement
  if (!backdrop) return
  backdrop.hidden = true
  backdrop.setAttribute('aria-hidden', 'true')
}

export function PvpLegacyResultSuppressor() {
  useEffect(() => {
    hideLegacyResultOverlay()
    const observer = new MutationObserver(() => hideLegacyResultOverlay())
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
