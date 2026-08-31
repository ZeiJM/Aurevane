'use client'

import { useLayoutEffect } from 'react'

const DESKTOP_PVP_TOKEN_QUERY = '(min-width: 821px)'
const DESKTOP_PVP_TOKEN_SIZE = 'clamp(2rem, 3.4vw, 3.4rem)'
const LARGE_DESKTOP_TOKEN_SIZE = 'clamp(1.6rem, 72%, 2.15rem)'
const COMPACT_TOKEN_SIZE = 'clamp(1.7rem, 56%, 2.75rem)'
const LARGE_COMPACT_TOKEN_SIZE = 'clamp(1.25rem, 72%, 1.75rem)'
const PLAYER_TOKEN_SHADOW = '0 0.45rem 1rem rgba(0, 0, 0, 0.35)'

function tileCoordinates(tile: HTMLButtonElement): { x: number; y: number } | null {
  const match = tile.getAttribute('aria-label')?.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return null
  return { x: Number(match[1]), y: Number(match[2]) }
}

function syncBoardScale(): { width: number; height: number } | null {
  const board = document.querySelector<HTMLElement>('#battlefield [data-board-auto-fit]')
  if (!board) return null

  const tiles = Array.from(board.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]'))
  let width = 0
  let height = 0
  for (const tile of tiles) {
    const coordinates = tileCoordinates(tile)
    if (!coordinates) continue
    width = Math.max(width, coordinates.x)
    height = Math.max(height, coordinates.y)
  }
  if (width <= 0 || height <= 0) return null

  // React can briefly expose a partially reconciled tile list while a submitted action or recruit
  // turn replaces the tactical snapshot. Never publish that transient partial rectangle as a new
  // board size: doing so makes the 9x7 Guided Fundamentals board visibly snap smaller for a frame.
  if (tiles.length !== width * height) return null

  const fit = `${width}x${height}`
  if (board.dataset.boardAutoFit !== fit) board.dataset.boardAutoFit = fit

  // Keep the renderer's real board ratio authoritative for every arena. The old presentation
  // authority assumed 9x7, which is what stretched the 13x9 large-map cells into rectangles.
  board.style.setProperty('aspect-ratio', `${width} / ${height}`, 'important')

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
