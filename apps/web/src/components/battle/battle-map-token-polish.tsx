'use client'

import { useEffect } from 'react'

const DESKTOP_BATTLE_QUERY = '(min-width: 821px)'
const DESKTOP_TOKEN_SIZE = 'clamp(1.7rem, 52%, 2.6rem)'
const COMPACT_TOKEN_SIZE = 'clamp(1.35rem, 50%, 2.1rem)'
const PLAYER_TOKEN_SHADOW = '0 0.45rem 1rem rgba(0, 0, 0, 0.35)'
const BOARD_COLUMNS = 9
const BOARD_ROWS = 7

const FACING_STYLE_PROPERTIES = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'text-shadow',
  'transform',
] as const

function numericCss(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function directToken(tile: HTMLButtonElement): HTMLElement | null {
  return tile.querySelector<HTMLElement>(':scope > span:last-child')
}

function polishDesktopBoardGeometry() {
  const board = document.querySelector<HTMLElement>(
    "#battlefield [data-board-auto-fit='9x7']",
  )
  const viewport = board?.parentElement
  if (!board || !(viewport instanceof HTMLElement)) return

  if (!window.matchMedia(DESKTOP_BATTLE_QUERY).matches) {
    board.removeAttribute('data-battle-square-geometry')
    board.style.removeProperty('width')
    board.style.removeProperty('height')
    return
  }

  const viewportStyle = window.getComputedStyle(viewport)
  const boardStyle = window.getComputedStyle(board)
  const innerWidth =
    viewport.clientWidth -
    numericCss(viewportStyle.paddingLeft) -
    numericCss(viewportStyle.paddingRight)
  const innerHeight =
    viewport.clientHeight -
    numericCss(viewportStyle.paddingTop) -
    numericCss(viewportStyle.paddingBottom)
  const columnGap = numericCss(boardStyle.columnGap)
  const rowGap = numericCss(boardStyle.rowGap)
  const tileByWidth = (innerWidth - columnGap * (BOARD_COLUMNS - 1)) / BOARD_COLUMNS
  const tileByHeight = (innerHeight - rowGap * (BOARD_ROWS - 1)) / BOARD_ROWS
  const tileSize = Math.floor(Math.min(tileByWidth, tileByHeight) * 100) / 100

  if (!Number.isFinite(tileSize) || tileSize <= 0) return

  const width = tileSize * BOARD_COLUMNS + columnGap * (BOARD_COLUMNS - 1)
  const height = tileSize * BOARD_ROWS + rowGap * (BOARD_ROWS - 1)
  board.dataset.battleSquareGeometry = 'true'
  board.style.setProperty('width', `${width}px`, 'important')
  board.style.setProperty('height', `${height}px`, 'important')
  board.style.setProperty('aspect-ratio', 'auto', 'important')

  for (const tile of board.querySelectorAll<HTMLButtonElement>(':scope > button')) {
    tile.style.setProperty('aspect-ratio', '1 / 1', 'important')
  }
}

function normalizeFacingArrows(
  occupiedTiles: HTMLButtonElement[],
  playerName: string | undefined,
) {
  const referenceTile = playerName
    ? occupiedTiles.find((tile) =>
        tile.getAttribute('aria-label')?.includes(`occupied by ${playerName}`),
      )
    : occupiedTiles[0]
  const referenceArrow = referenceTile
    ? directToken(referenceTile)?.querySelector<HTMLElement>(':scope > i')
    : null
  if (!referenceArrow) return

  const referenceStyle = window.getComputedStyle(referenceArrow)
  for (const tile of occupiedTiles) {
    const arrow = directToken(tile)?.querySelector<HTMLElement>(':scope > i')
    if (!arrow || arrow === referenceArrow) continue

    for (const property of FACING_STYLE_PROPERTIES) {
      arrow.style.setProperty(property, referenceStyle.getPropertyValue(property), 'important')
    }
    arrow.style.setProperty('pointer-events', 'none', 'important')
  }
}

function polishBattlefieldTokens(playerName?: string) {
  polishDesktopBoardGeometry()

  const desktopScale = window.matchMedia(DESKTOP_BATTLE_QUERY).matches
  const tokenSize = desktopScale ? DESKTOP_TOKEN_SIZE : COMPACT_TOKEN_SIZE
  const pveBattle = Boolean(document.querySelector("main[data-battle-kind='pve']"))
  const occupiedTiles = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  )

  for (const tile of occupiedTiles) {
    const token = directToken(tile)
    if (!token) continue

    // Keep every badge comfortably inside its square grid cell at both desktop and phone scales.
    token.style.setProperty('position', 'absolute', 'important')
    token.style.setProperty('top', '50%', 'important')
    token.style.setProperty('left', '50%', 'important')
    token.style.setProperty('z-index', '4', 'important')
    token.style.setProperty('width', tokenSize, 'important')
    token.style.setProperty('height', tokenSize, 'important')
    token.style.setProperty('aspect-ratio', '1 / 1', 'important')
    token.style.setProperty('transform', 'translate(-50%, -50%)', 'important')

    const name = token.querySelector<HTMLElement>(':scope > strong')
    if (name) {
      const isAiPlayerToken = Boolean(
        pveBattle && playerName && name.textContent?.trim() === playerName,
      )
      name.style.display = 'none'

      // PvE only: keep the player's green ownership border, but remove the extra active-turn halo.
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

  // The local player's arrow is the approved reference. Copy its final computed geometry and type
  // treatment to AI enemies, recruits, and remote PvP players so no mode-specific layer can drift.
  normalizeFacingArrows(occupiedTiles, playerName)
}

interface BattleMapTokenPolishProps {
  playerName?: string
}

export function BattleMapTokenPolish({ playerName }: BattleMapTokenPolishProps = {}) {
  useEffect(() => {
    const polish = () => polishBattlefieldTokens(playerName)

    polish()
    const battlefield = document.querySelector<HTMLElement>('#battlefield')
    if (!battlefield) return

    const observer = new MutationObserver(polish)
    observer.observe(battlefield, { childList: true, subtree: true })
    const resizeObserver = new ResizeObserver(polish)
    resizeObserver.observe(battlefield)
    window.addEventListener('resize', polish)

    return () => {
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('resize', polish)
    }
  }, [playerName])

  return null
}
