'use client'

import { useLayoutEffect, useRef } from 'react'

const DESKTOP_QUERY = '(min-width: 821px)'

type Position = { x: number; y: number }

function tilePosition(button: HTMLButtonElement): Position | null {
  const match = button.getAttribute('aria-label')?.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return null
  return { x: Number(match[1]) - 1, y: Number(match[2]) - 1 }
}

function positionKey(position: Position): string {
  return `${position.x}:${position.y}`
}

function directionForCode(code: string): Position | null {
  if (code === 'KeyW' || code === 'ArrowUp') return { x: 0, y: -1 }
  if (code === 'KeyS' || code === 'ArrowDown') return { x: 0, y: 1 }
  if (code === 'KeyA' || code === 'ArrowLeft') return { x: -1, y: 0 }
  if (code === 'KeyD' || code === 'ArrowRight') return { x: 1, y: 0 }
  return null
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function moveButton(root: HTMLElement): HTMLButtonElement | null {
  return (
    Array.from(
      root.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
    ).find((button) => button.querySelector(':scope > strong')?.textContent?.trim() === 'Move') ?? null
  )
}

function moveIsActive(root: HTMLElement): boolean {
  const button = moveButton(root)
  return Boolean(
    button &&
      (button.hasAttribute('data-active') ||
        button.dataset.battleActive === 'true' ||
        `${button.className}`.includes('commandActive')),
  )
}

function battleTiles(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]'),
  )
}

function playerTile(root: HTMLElement, playerName: string): HTMLButtonElement | null {
  return (
    battleTiles(root).find((button) =>
      (button.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
    ) ?? null
  )
}

export function PveDesktopMoveKeyboardParity({ playerName }: { playerName: string }) {
  const movementPlan = useRef<{ committedOriginKey: string; endpoint: Position } | null>(null)

  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>('main[data-battle-kind="pve"]')
    const media = window.matchMedia(DESKTOP_QUERY)
    if (!root) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!media.matches || isTextEntryTarget(event.target) || event.repeat) return
      const direction = directionForCode(event.code)
      if (!direction || !moveIsActive(root)) return

      const actor = playerTile(root, playerName)
      const committed = actor ? tilePosition(actor) : null
      if (!actor || !committed) return

      const committedOriginKey = positionKey(committed)
      if (!movementPlan.current || movementPlan.current.committedOriginKey !== committedOriginKey) {
        movementPlan.current = { committedOriginKey, endpoint: committed }
      }

      const base = movementPlan.current.endpoint
      const next = { x: base.x + direction.x, y: base.y + direction.y }
      const movingBackToOrigin = next.x === committed.x && next.y === committed.y

      event.preventDefault()
      event.stopImmediatePropagation()

      if (movingBackToOrigin) {
        const move = moveButton(root)
        if (!move || move.disabled) return
        move.click()
        movementPlan.current = { committedOriginKey, endpoint: committed }
        actor.focus({ preventScroll: true })
        return
      }

      const prefix = `Tile ${next.x + 1}, ${next.y + 1};`
      const target = battleTiles(root).find((button) =>
        (button.getAttribute('aria-label') ?? '').startsWith(prefix),
      )
      if (!target || target.disabled) return
      if ((target.getAttribute('aria-label') ?? '').includes('occupied by ')) return
      if (!target.hasAttribute('data-reachable')) return

      movementPlan.current = { committedOriginKey, endpoint: next }
      target.focus({ preventScroll: true })
      target.click()
    }

    const reset = () => {
      if (!moveIsActive(root)) movementPlan.current = null
    }

    const observer = new MutationObserver(reset)
    const deck = root.querySelector('section[aria-label="Command Deck"]')
    if (deck) observer.observe(deck, { subtree: true, attributes: true, attributeFilter: ['data-active', 'class'] })

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [playerName])

  return null
}
