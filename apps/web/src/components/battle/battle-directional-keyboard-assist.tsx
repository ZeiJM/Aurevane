'use client'

import { useEffect, useRef } from 'react'

type GridPosition = { x: number; y: number }
type Direction = { dx: number; dy: number }

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function directionForCode(code: string): Direction | null {
  if (code === 'ArrowUp' || code === 'KeyW') return { dx: 0, dy: -1 }
  if (code === 'ArrowDown' || code === 'KeyS') return { dx: 0, dy: 1 }
  if (code === 'ArrowLeft' || code === 'KeyA') return { dx: -1, dy: 0 }
  if (code === 'ArrowRight' || code === 'KeyD') return { dx: 1, dy: 0 }
  return null
}

function commandButton(label: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
    ).find((button) => button.querySelector('strong')?.textContent?.trim() === label) ?? null
  )
}

function commandIsActive(label: string): boolean {
  const button = commandButton(label)
  return Boolean(button && `${button.className}`.includes('commandActive'))
}

function facingModeIsActive(): boolean {
  return Boolean(document.querySelector<HTMLButtonElement>('[aria-label="Face north"]:not(:disabled)'))
}

function chooseFacing(direction: Direction): boolean {
  const label =
    direction.dy < 0
      ? 'Face north'
      : direction.dy > 0
        ? 'Face south'
        : direction.dx < 0
          ? 'Face west'
          : 'Face east'
  const button = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
  if (!button || button.disabled) return false
  button.click()
  return true
}

function battleTiles(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]'),
  )
}

function tilePosition(button: HTMLButtonElement): GridPosition | null {
  const match = button.getAttribute('aria-label')?.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return null
  return { x: Number(match[1]) - 1, y: Number(match[2]) - 1 }
}

function samePosition(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y
}

function playerTile(playerName: string): HTMLButtonElement | null {
  return (
    battleTiles().find((button) =>
      (button.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
    ) ?? null
  )
}

function tileAt(position: GridPosition): HTMLButtonElement | null {
  const prefix = `Tile ${position.x + 1}, ${position.y + 1};`
  return (
    battleTiles().find((button) => (button.getAttribute('aria-label') ?? '').startsWith(prefix)) ??
    null
  )
}

export function BattleDirectionalKeyboardAssist({ playerName }: { playerName: string }) {
  const movementTrail = useRef<GridPosition[]>([])
  const committedOrigin = useRef<GridPosition | null>(null)

  useEffect(() => {
    function resetTrail(origin?: GridPosition | null) {
      committedOrigin.current = origin ? { ...origin } : null
      movementTrail.current = origin ? [{ ...origin }] : []
    }

    function handleMove(direction: Direction): boolean {
      const actor = playerTile(playerName)
      const origin = actor ? tilePosition(actor) : null
      if (!origin) return false

      if (!committedOrigin.current || !samePosition(committedOrigin.current, origin)) {
        resetTrail(origin)
      }
      if (movementTrail.current.length === 0) movementTrail.current = [{ ...origin }]

      const current = movementTrail.current.at(-1) ?? origin
      const target = { x: current.x + direction.dx, y: current.y + direction.dy }
      const previous = movementTrail.current.at(-2) ?? null

      // Directional input can walk the projected path backward. Reaching the committed character
      // tile clears the preview while leaving Move selected, so the player can immediately project
      // through the origin and out in another direction.
      if (previous && samePosition(target, previous)) {
        const nextTrail = movementTrail.current.slice(0, -1)
        if (nextTrail.length <= 1) {
          const move = commandButton('Move')
          if (!move || move.disabled) return false
          move.click()
          resetTrail(origin)
          return true
        }

        const targetButton = tileAt(target)
        if (!targetButton || targetButton.disabled) return false
        targetButton.focus({ preventScroll: true })
        targetButton.click()
        movementTrail.current = nextTrail
        return true
      }

      const targetButton = tileAt(target)
      if (!targetButton || targetButton.disabled) return false
      if ((targetButton.getAttribute('aria-label') ?? '').includes('occupied by ')) return false
      if (!`${targetButton.className}`.includes('tileReachable')) return false

      targetButton.focus({ preventScroll: true })
      targetButton.click()
      movementTrail.current = [...movementTrail.current, target]
      return true
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target) || !event.code) return
      const direction = directionForCode(event.code)
      if (!direction) return

      if (commandIsActive('Move')) {
        event.preventDefault()
        event.stopImmediatePropagation()
        handleMove(direction)
        return
      }

      if (facingModeIsActive()) {
        event.preventDefault()
        event.stopImmediatePropagation()
        chooseFacing(direction)
        return
      }

      resetTrail()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [playerName])

  return null
}
