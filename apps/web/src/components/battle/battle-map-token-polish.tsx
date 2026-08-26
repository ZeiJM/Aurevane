'use client'

import { useEffect } from 'react'

function polishBattlefieldTokens() {
  const occupiedTiles = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  )

  for (const tile of occupiedTiles) {
    const token = tile.querySelector<HTMLElement>(':scope > span:last-child')
    if (!token) continue

    // Match PvP's map-token footprint without touching the battlefield grid or tile geometry.
    token.style.position = 'absolute'
    token.style.top = '50%'
    token.style.left = '50%'
    token.style.zIndex = '4'
    token.style.width = 'clamp(1.7rem, 56%, 2.75rem)'
    token.style.height = 'auto'
    token.style.aspectRatio = '1'
    token.style.transform = 'translate(-50%, -50%)'

    const name = token.querySelector<HTMLElement>(':scope > strong')
    if (name) name.style.display = 'none'

    for (const image of Array.from(token.querySelectorAll<HTMLImageElement>('img'))) {
      image.style.width = '100%'
      image.style.height = '100%'
      image.style.objectFit = 'cover'
      image.style.objectPosition = '50% 50%'
      image.style.borderRadius = '50%'
    }
  }
}

export function BattleMapTokenPolish() {
  useEffect(() => {
    polishBattlefieldTokens()
    const battlefield = document.querySelector('#battlefield')
    if (!battlefield) return

    const observer = new MutationObserver(polishBattlefieldTokens)
    observer.observe(battlefield, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
