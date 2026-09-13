'use client'

import { useLayoutEffect } from 'react'

const DESKTOP_PVP_TOKEN_QUERY = '(min-width: 821px)'
const PLAYER_TOKEN_SHADOW = '0 0.45rem 1rem rgba(0, 0, 0, 0.35)'
const DAMAGE_COLOR = '#ff766f'
const HEALING_COLOR = '#59d39b'
const DEFENSE_COLOR = '#6c91c6'

const TARGET_BACKGROUNDS: Readonly<Record<string, string>> = {
  [DAMAGE_COLOR]: 'rgba(255, 118, 111, 0.18)',
  [HEALING_COLOR]: 'rgba(89, 211, 155, 0.18)',
  [DEFENSE_COLOR]: 'rgba(108, 145, 198, 0.2)',
}

const TARGET_SHADOWS: Readonly<Record<string, string>> = {
  [DAMAGE_COLOR]:
    'inset 0 0 0 2px rgba(255, 118, 111, 0.46), 0 0 0.75rem rgba(255, 118, 111, 0.22)',
  [HEALING_COLOR]: 'inset 0 0 0 2px rgba(89, 211, 155, 0.46), 0 0 0.75rem rgba(89, 211, 155, 0.22)',
  [DEFENSE_COLOR]:
    'inset 0 0 0 2px rgba(108, 145, 198, 0.46), 0 0 0.75rem rgba(108, 145, 198, 0.22)',
}

export function fitBattleBoard(
  columns: number,
  rows: number,
  availableWidth: number,
  availableHeight: number,
): { width: number; height: number } {
  const scale = Math.min(availableWidth / columns, availableHeight / rows)
  return { width: columns * scale, height: rows * scale }
}

function syncBoardScale(): { width: number; height: number } | null {
  const board = document.querySelector<HTMLElement>('#battlefield [data-board-auto-fit]')
  if (!board) return null

  const fit = board.dataset.boardAutoFit?.match(/^(\d+)x(\d+)$/)
  if (!fit) return null

  const width = Number(fit[1])
  const height = Number(fit[2])
  if (width <= 0 || height <= 0) return null

  // Fit the authoritative map dimensions into the space left by the cockpit and history. A
  // width-only board can have its lower rows clipped when the available viewport height shrinks.
  // This bundle is shared with spectators, so every desktop map uses the same sizing boundary.
  const viewport = board.parentElement
  if (window.matchMedia(DESKTOP_PVP_TOKEN_QUERY).matches && viewport) {
    const style = getComputedStyle(viewport)
    const availableWidth =
      viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const availableHeight =
      viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    if (availableWidth <= 0 || availableHeight <= 0) return { width, height }
    const fitted = fitBattleBoard(width, height, availableWidth, availableHeight)
    board.style.setProperty('box-sizing', 'border-box', 'important')
    board.style.setProperty('width', `${fitted.width}px`, 'important')
    board.style.setProperty('max-width', '100%', 'important')
    board.style.setProperty('height', `${fitted.height}px`, 'important')
    board.style.setProperty('max-height', '100%', 'important')
  } else if (width === 13 && height === 9) {
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

function activeCommandSlug(): string | null {
  const nativeActive = document.querySelector<HTMLButtonElement>(
    'section[aria-label="Command Deck"] button[data-active="true"]',
  )
  const label = nativeActive?.querySelector<HTMLElement>(':scope > strong')?.textContent?.trim()
  if (label === 'Basic Attack') return 'attack'
  if (label === 'Recover') return 'recover'
  if (label === 'Guard') return 'guard'

  return (
    document.querySelector<HTMLElement>('[data-battle-command][data-battle-active="true"]')?.dataset
      .battleCommand ?? null
  )
}

function activeSemanticColor(tile: HTMLButtonElement): string | null {
  const activeCommand = activeCommandSlug()
  const targetRelation = tile.dataset.target

  if (activeCommand === 'attack' && targetRelation === 'enemy') return DAMAGE_COLOR
  if (activeCommand === 'recover' && targetRelation === 'friendly') return HEALING_COLOR
  if (activeCommand === 'guard' && targetRelation === 'friendly') return DEFENSE_COLOR
  return null
}

function syncSemanticTargetTile(tile: HTMLButtonElement, semanticAccent: string | null): void {
  if (!semanticAccent) {
    tile.style.removeProperty('background-color')
    tile.style.removeProperty('border-color')
    tile.style.removeProperty('box-shadow')
    return
  }

  const background = TARGET_BACKGROUNDS[semanticAccent]
  if (background) tile.style.setProperty('background-color', background, 'important')
  tile.style.setProperty('border-color', semanticAccent, 'important')
  const shadow = TARGET_SHADOWS[semanticAccent]
  if (shadow) tile.style.setProperty('box-shadow', shadow, 'important')
}

function combatantNameForTile(
  tile: HTMLButtonElement,
  token: HTMLElement,
  combatantAccents: Readonly<Record<string, string>>,
): string {
  const tokenName = token.querySelector<HTMLElement>(':scope > strong')?.textContent?.trim() ?? ''
  if (tokenName && combatantAccents[tokenName]) return tokenName

  // Shared battle rendering is allowed to remove or relocate the hidden token-name element. The
  // tile's accessibility label remains the stable identity source in both playable and spectator
  // views, so use it as the fallback instead of reverting to legacy team red/green borders.
  const label = tile.getAttribute('aria-label') ?? ''
  const occupiedName = label.match(/occupied by ([^;]+)(?:;|$)/i)?.[1]?.trim() ?? ''
  return occupiedName && combatantAccents[occupiedName] ? occupiedName : tokenName
}

function polishBattlefieldTokens(
  playerName?: string,
  combatantAccents: Readonly<Record<string, string>> = {},
) {
  const desktopPvpScale = window.matchMedia(DESKTOP_PVP_TOKEN_QUERY).matches
  syncBoardScale()
  const occupiedTiles = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  )

  for (const tile of occupiedTiles) {
    const token =
      tile.querySelector<HTMLElement>(':scope > [data-battle-shared-token="true"]') ??
      tile.querySelector<HTMLElement>(':scope > [data-team]') ??
      tile.querySelector<HTMLElement>(':scope > span:last-child')
    if (!token) continue

    // Portraits, rings and facing cues scale from the actual tile, including nonstandard maps.
    const cell = tile.getBoundingClientRect()
    const tokenSize = `${Math.max(0, Math.min(cell.width, cell.height) * 0.68)}px`
    token.style.setProperty('--battle-token-size', tokenSize)
    token.style.setProperty('position', 'absolute', 'important')
    token.style.setProperty('top', '50%', 'important')
    token.style.setProperty('left', '50%', 'important')
    token.style.setProperty('z-index', '4', 'important')
    token.style.setProperty('width', tokenSize, 'important')
    token.style.setProperty('height', tokenSize, 'important')
    token.style.setProperty('aspect-ratio', '1', 'important')
    token.style.setProperty('transform', 'translate(-50%, -50%)', 'important')

    const name = token.querySelector<HTMLElement>(':scope > strong')
    const combatantName = combatantNameForTile(tile, token, combatantAccents)
    const identityAccent = combatantName ? combatantAccents[combatantName] : undefined
    const semanticAccent = activeSemanticColor(tile)
    syncSemanticTargetTile(tile, semanticAccent)
    const tokenAccent = semanticAccent ?? identityAccent
    if (tokenAccent) token.style.setProperty('border-color', tokenAccent, 'important')
    else token.style.removeProperty('border-color')

    const isAiPlayerToken = Boolean(playerName && combatantName === playerName)
    const compactViewport = !desktopPvpScale
    if (compactViewport || isAiPlayerToken) {
      token.style.setProperty('box-shadow', PLAYER_TOKEN_SHADOW, 'important')
    } else {
      token.style.removeProperty('box-shadow')
    }

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

interface BattleMapTokenPolishProps {
  playerName?: string
  combatantAccents?: Readonly<Record<string, string>>
}

export function BattleMapTokenPolish({
  playerName,
  combatantAccents = {},
}: BattleMapTokenPolishProps = {}) {
  useLayoutEffect(() => {
    const polish = () => polishBattlefieldTokens(playerName, combatantAccents)

    polish()
    const battlefield = document.querySelector('#battlefield')
    if (!battlefield) return

    const battlefieldObserver = new MutationObserver(polish)
    battlefieldObserver.observe(battlefield, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-target'],
    })

    const boardViewport = battlefield.querySelector('[data-board-auto-fit]')?.parentElement
    const sizeObserver = new ResizeObserver(polish)
    if (boardViewport) sizeObserver.observe(boardViewport)

    const commandDeck = document.querySelector('section[aria-label="Command Deck"]')
    const commandObserver = commandDeck ? new MutationObserver(polish) : null
    commandObserver?.observe(commandDeck!, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-active', 'data-battle-active'],
    })

    window.addEventListener('resize', polish)

    return () => {
      battlefieldObserver.disconnect()
      sizeObserver.disconnect()
      commandObserver?.disconnect()
      window.removeEventListener('resize', polish)
    }
  }, [combatantAccents, playerName])

  return null
}
