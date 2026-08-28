'use client'

import { useEffect } from 'react'

const DESKTOP_PVP_TOKEN_QUERY = '(min-width: 821px)'
const DESKTOP_PVP_TOKEN_SIZE = 'clamp(2rem, 3.4vw, 3.4rem)'
const COMPACT_TOKEN_SIZE = 'clamp(1.7rem, 56%, 2.75rem)'
const PLAYER_TOKEN_SHADOW = '0 0.45rem 1rem rgba(0, 0, 0, 0.35)'

function polishBattlefieldTokens(playerName: string) {
  const desktopPvpScale = window.matchMedia(DESKTOP_PVP_TOKEN_QUERY).matches
  const tokenSize = desktopPvpScale ? DESKTOP_PVP_TOKEN_SIZE : COMPACT_TOKEN_SIZE
  const occupiedTiles = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  )

  for (const tile of occupiedTiles) {
    const token = tile.querySelector<HTMLElement>(':scope > span:last-child')
    if (!token) continue

    // Keep AI tokens on the same responsive footprint as the live PvP battlefield.
    token.style.position = 'absolute'
    token.style.top = '50%'
    token.style.left = '50%'
    token.style.zIndex = '4'
    token.style.width = tokenSize
    token.style.height = desktopPvpScale ? tokenSize : 'auto'
    token.style.aspectRatio = '1'
    token.style.transform = 'translate(-50%, -50%)'

    const name = token.querySelector<HTMLElement>(':scope > strong')
    if (name) {
      const isPlayerToken = name.textContent?.trim() === playerName
      name.style.display = 'none'

      // Keep the player's green ownership border, but remove the extra active-turn halo ring.
      // The ordinary depth shadow remains so the portrait still separates cleanly from the tile.
      if (isPlayerToken) token.style.boxShadow = PLAYER_TOKEN_SHADOW
    }

    for (const image of Array.from(token.querySelectorAll<HTMLImageElement>('img'))) {
      image.style.width = '100%'
      image.style.height = '100%'
      image.style.objectFit = 'cover'
      image.style.objectPosition = '50% 50%'
      image.style.borderRadius = '50%'
    }
  }
}

interface BattleMapTokenPolishProps {
  playerName: string
}

export function BattleMapTokenPolish({ playerName }: BattleMapTokenPolishProps) {
  useEffect(() => {
    const polish = () => polishBattlefieldTokens(playerName)

    polish()
    const battlefield = document.querySelector('#battlefield')
    if (!battlefield) return

    const observer = new MutationObserver(polish)
    observer.observe(battlefield, { childList: true, subtree: true })
    window.addEventListener('resize', polish)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', polish)
    }
  }, [playerName])

  return null
}
