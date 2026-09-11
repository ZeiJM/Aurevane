'use client'

import { useLayoutEffect } from 'react'

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function directionForCode(code: string): { dx: number; dy: number } | null {
  if (code === 'ArrowUp' || code === 'KeyW') return { dx: 0, dy: -1 }
  if (code === 'ArrowDown' || code === 'KeyS') return { dx: 0, dy: 1 }
  if (code === 'ArrowLeft' || code === 'KeyA') return { dx: -1, dy: 0 }
  if (code === 'ArrowRight' || code === 'KeyD') return { dx: 1, dy: 0 }
  return null
}

function tilePosition(button: HTMLButtonElement): { x: number; y: number } | null {
  const match = button.getAttribute('aria-label')?.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return null
  return { x: Number(match[1]) - 1, y: Number(match[2]) - 1 }
}

function moveModeIsActive(): boolean {
  const button = document.querySelector<HTMLButtonElement>(
    'section[aria-label="Command Deck"] button[data-command-slot="move"]',
  )
  return Boolean(
    button &&
    (button.hasAttribute('data-active') ||
      button.dataset.battleActive === 'true' ||
      `${button.className}`.includes('commandActive')),
  )
}

function battlefieldTiles(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]'),
  )
}

function playerTile(
  playerName: string,
  tiles: readonly HTMLButtonElement[],
): HTMLButtonElement | null {
  return (
    tiles.find((tile) =>
      (tile.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
    ) ?? null
  )
}

function pathTiles(tiles: readonly HTMLButtonElement[]): HTMLButtonElement[] {
  return tiles
    .filter((tile) => tile.hasAttribute('data-path-index'))
    .sort(
      (left, right) =>
        Number(left.getAttribute('data-path-index')) -
        Number(right.getAttribute('data-path-index')),
    )
}

function positionsEqual(left: { x: number; y: number }, right: { x: number; y: number }): boolean {
  return left.x === right.x && left.y === right.y
}

export function BattleMovementKeyboardAssist({ playerName }: { playerName: string }) {
  useLayoutEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target) || event.repeat || !moveModeIsActive()) return
      const direction = directionForCode(event.code)
      if (!direction) return

      // Move-mode directional input has one shared owner so PvE and PvP cannot diverge or double-handle
      // the same key. The rendered path is the current source of truth because mouse clicks may also
      // have edited it between keyboard presses.
      event.preventDefault()
      event.stopImmediatePropagation()

      const tiles = battlefieldTiles()
      const origin = playerTile(playerName, tiles)
      if (!origin) return
      const plotted = pathTiles(tiles)
      const endpoint = plotted.at(-1) ?? origin
      const endpointPosition = tilePosition(endpoint)
      if (!endpointPosition) return

      const targetPosition = {
        x: endpointPosition.x + direction.dx,
        y: endpointPosition.y + direction.dy,
      }
      const target = tiles.find((tile) => {
        const position = tilePosition(tile)
        return position ? positionsEqual(position, targetPosition) : false
      })
      if (!target || target.disabled) return

      const targetPathIndex = target.getAttribute('data-path-index')
      if (targetPathIndex !== null) {
        // Clicking any earlier point is already the canonical mouse behavior for trimming a projected
        // path. Reuse it for WASD so one opposite key removes exactly one step.
        target.focus({ preventScroll: true })
        target.click()
        return
      }

      const label = target.getAttribute('aria-label') ?? ''
      if (label.includes('occupied by ') || !target.hasAttribute('data-reachable')) return
      target.focus({ preventScroll: true })
      target.click()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [playerName])

  return null
}
