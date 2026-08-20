'use client'

import { useEffect } from 'react'

export function SiteInteractionGuard() {
  useEffect(() => {
    function blockContextMenu(event: MouseEvent) {
      event.preventDefault()
    }

    document.addEventListener('contextmenu', blockContextMenu, { capture: true })
    return () => document.removeEventListener('contextmenu', blockContextMenu, { capture: true })
  }, [])

  return null
}
