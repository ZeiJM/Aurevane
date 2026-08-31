'use client'

import { useLayoutEffect } from 'react'

const DESKTOP_PVP_TOKEN_QUERY = '(min-width: 821px)'
const DESKTOP_PVP_TOKEN_SIZE = 'clamp(2rem, 3.4vw, 3.4rem)'
const LARGE_DESKTOP_TOKEN_SIZE = 'clamp(1.6rem, 72%, 2.15rem)'
const COMPACT_TOKEN_SIZE = 'clamp(1.7rem, 56%, 2.75rem)'
const LARGE_COMPACT_TOKEN_SIZE = 'clamp(1.25rem, 72%, 1.75rem)'
const PLAYER_TOKEN_SHADOW = '0 0.45rem 1rem rgba(0, 0, 0, 0.35)'

function syncBoardScale(): { width: number; height: number } | null {
  const board = document.querySelector<HTMLElement>('#battlefield [data-board-auto-fit]')
  if (!board) return null

  const fit = board.dataset.boardAutoFit?.match(/^(\d+)x(\d+)$/)
  if (!fit) return null

  const width = Number(fit[1])
  const height = Number(fit[2])
  if (width <= 0 || height <= 0) return null

  // BattleExperience publishes the authoritative tactical width/height directly. This helper only
  // preserves the established large-board cap; it no longer derives board geometry from live tile
  // DOM, so transient React reconciliation cannot change the board-size contract.
  if (width === 13 && height === 9) {
    board.style.setProperty('box-sizing', 'border-box', 'important')
    board.style.setProperty('width', 'min(100%, 620px)', 'important')
    board.style.setProperty('max-width', '620px', 'important')
    board.style.setProperty('height', 'auto', 'important')
    board.style.setProperty('max-height', 'none', 'important')
  } else {
    board.style.removeProperty('box-sizing')
    board.style.removeProperty('width')
    board.style.removeProperty('max-width')
    board.style.removeProperty('height')
    board.style.removeProperty('max-height')
  }

  return { width, height }
}

function polishBattlefieldTokens(playerName?: string) {
  const desktopPvpScale = window.matchMedia(DESKTOP_PVP_TOKEN_QUERY).matches
  const board = syncBoardScale()
  const largeBoard = board?.width === 13 && board.height === 9
  const tokenSize = largeBoard
    ? desktopPvpScale
      ? LARGE_DESKTOP_TOKEN_SIZE
      : LARGE_COMPACT_TOKEN_SIZE
    : desktopPvpScale
      ? DESKTOP_PVP_TOKEN_SIZE
      : COMPACT_TOKEN_SIZE
  const occupiedTiles = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  )

  for (const tile of occupiedTiles) {
    const token =
      tile.querySelector<HTMLElement>(':scope > [data-battle-shared-token="true"]') ??
      tile.querySelector<HTMLElement>(':scope > [data-team]') ??
      tile.querySelector<HTMLElement>(':scope > span:last-child')
    if (!token) continue

    // Medium boards retain the established token footprint. Large boards deliberately use a
    // smaller cap on desktop and mobile so portraits, facing arrows, and the HP/MP meters remain
    // visually contained by the smaller square cells.
    token.style.setProperty('position', 'absolute', 'important')
    token.style.setProperty('top', '50%', 'important')
    token.style.setProperty('left', '50%', 'important')
    token.style.setProperty('z-index', '4', 'important')
    token.style.setProperty('width', tokenSize, 'important')
    token.style.setProperty('height', tokenSize, 'important')
    token.style.setProperty('aspect-ratio', '1', 'important')
    token.style.setProperty('transform', 'translate(-50%, -50%)', 'important')

    const name = token.querySelector<HTMLElement>(':scope > strong')
    if (name) {
      const isAiPlayerToken = Boolean(playerName && name.textContent?.trim() === playerName)
      name.style.display = 'none'

      // AI only: keep the player's green ownership border, but remove the extra active-turn halo ring.
      // PvP does not pass playerName here, so its active-token presentation remains unchanged.
      if (isAiPlayerToken) token.style.boxShadow = PLAYER_TOKEN_SHADOW
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
  playerName?: string
}

export function BattleMapTokenPolish({ playerName }: BattleMapTokenPolishProps = {}) {
  useLayoutEffect(() => {
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
