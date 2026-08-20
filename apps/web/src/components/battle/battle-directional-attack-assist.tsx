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

function basicAttackButton(): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
    ).find((button) => button.querySelector('strong')?.textContent?.trim() === 'Basic Attack') ?? null
  )
}

function attackModeIsActive(): boolean {
  const button = basicAttackButton()
  if (!button || button.disabled) return false
  return button.hasAttribute('data-active') || `${button.className}`.includes('commandActive')
}

function playerTile(playerName: string): HTMLButtonElement | null {
  return (
    battleTiles().find((button) =>
      (button.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
    ) ?? null
  )
}

function isLegalAttackTarget(button: HTMLButtonElement): boolean {
  return button.dataset.attackRange === 'legal' || button.dataset.target === 'enemy'
}

function confirmButton(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim().startsWith('Confirm Action') ?? false,
    ) ?? null
  )
}

function commitWhenPreviewReady() {
  let attempts = 0
  const timer = window.setInterval(() => {
    attempts += 1
    const confirm = confirmButton()
    if (confirm && !confirm.disabled) {
      window.clearInterval(timer)
      confirm.click()
      return
    }
    if (attempts >= 40 || !attackModeIsActive()) window.clearInterval(timer)
  }, 50)
}

export function BattleDirectionalAttackAssist({ playerName }: { playerName: string }) {
  useEffect(() => {
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
      if (!direction || !attackModeIsActive()) return

      const actor = playerTile(playerName)
      const origin = actor ? tilePosition(actor) : null
      if (!origin) return

      const targetPosition = { x: origin.x + direction.dx, y: origin.y + direction.dy }
      const targetPrefix = `Tile ${targetPosition.x + 1}, ${targetPosition.y + 1};`
      const target = battleTiles().find((button) =>
        (button.getAttribute('aria-label') ?? '').startsWith(targetPrefix),
      )
      if (!target || target.disabled || !isLegalAttackTarget(target)) return

      event.preventDefault()
      event.stopImmediatePropagation()
      target.focus({ preventScroll: true })
      target.click()
      commitWhenPreviewReady()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [playerName])

  return null
}
