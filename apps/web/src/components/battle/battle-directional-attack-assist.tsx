'use client'

import { useEffect } from 'react'

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

function battleTiles(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]'),
  )
}

function attackButton(): HTMLButtonElement | null {
  const deck = document.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
  if (!deck) return null

  return (
    deck.querySelector<HTMLButtonElement>(
      'button[data-command-slot="attack"], button[data-battle-command="attack"]',
    ) ??
    Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.querySelector('strong')?.textContent?.trim() === 'Basic Attack',
    ) ??
    null
  )
}

function attackModeIsActive(): boolean {
  const button = attackButton()
  if (!button || button.disabled) return false
  return (
    button.hasAttribute('data-active') ||
    button.dataset.battleActive === 'true' ||
    `${button.className}`.includes('commandActive')
  )
}

function playerTile(playerName: string): HTMLButtonElement | null {
  return (
    battleTiles().find((button) =>
      (button.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
    ) ?? null
  )
}

function isLegalAttackTarget(button: HTMLButtonElement): boolean {
  return button.dataset.target === 'enemy' || button.dataset.attackRange === 'legal'
}

function targetInDirection(
  origin: { x: number; y: number },
  direction: { dx: number; dy: number },
): HTMLButtonElement | null {
  const candidates = battleTiles()
    .map((button) => ({ button, position: tilePosition(button) }))
    .filter(
      (entry): entry is { button: HTMLButtonElement; position: { x: number; y: number } } =>
        entry.position !== null && !entry.button.disabled && isLegalAttackTarget(entry.button),
    )
    .map((entry) => {
      const deltaX = entry.position.x - origin.x
      const deltaY = entry.position.y - origin.y
      const forward = deltaX * direction.dx + deltaY * direction.dy
      const perpendicular = direction.dx !== 0 ? Math.abs(deltaY) : Math.abs(deltaX)
      const distance = Math.abs(deltaX) + Math.abs(deltaY)
      return { ...entry, forward, perpendicular, distance }
    })
    .filter((entry) => entry.forward > 0)
    .sort(
      (left, right) =>
        left.perpendicular - right.perpendicular ||
        left.distance - right.distance ||
        left.forward - right.forward,
    )

  return candidates[0]?.button ?? null
}

function confirmButton(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim().startsWith('Confirm Action') ?? false,
    ) ?? null
  )
}

export function BattleDirectionalAttackAssist({ playerName }: { playerName: string }) {
  useEffect(() => {
    let armedTarget: string | null = null

    function handleKeyDown(event: KeyboardEvent) {
      if (
        isTextEntryTarget(event.target) ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return
      }
      const direction = directionForCode(event.code)
      if (!direction) return
      if (!attackModeIsActive()) {
        armedTarget = null
        return
      }

      const actor = playerTile(playerName)
      const origin = actor ? tilePosition(actor) : null
      if (!origin) return

      const target = targetInDirection(origin, direction)
      if (!target) return
      const targetKey = target.getAttribute('aria-label') ?? ''

      event.preventDefault()
      event.stopImmediatePropagation()

      if (armedTarget === targetKey) {
        const confirm = confirmButton()
        if (confirm && !confirm.disabled) {
          armedTarget = null
          confirm.click()
          return
        }
      }

      target.focus({ preventScroll: true })
      target.click()
      armedTarget = targetKey
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [playerName])

  // Final-facing authority remains mounted for keyboard/map-guide behavior; only the retired
  // inline row is visually suppressed so Space cannot paint controls across the command cockpit.
  return <style>{'[data-unified-facing-pad="true"] { display: none !important; }'}</style>
}
