'use client'

import { useLayoutEffect } from 'react'

type Facing = 'north' | 'east' | 'south' | 'west'

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function desktopAiBattleIsActive(): boolean {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  const root = battlefield?.closest<HTMLElement>('main') ?? null
  return Boolean(
    root &&
      root.dataset.pvpBattle !== 'true' &&
      window.matchMedia('(min-width: 821px)').matches,
  )
}

function finalFacingModeIsActive(): boolean {
  return Boolean(
    document.querySelector<HTMLButtonElement>('button[aria-label="Face north"]:not(:disabled)') &&
      document.querySelector<HTMLButtonElement>('button[aria-label="Face east"]:not(:disabled)') &&
      document.querySelector<HTMLButtonElement>('button[aria-label="Face south"]:not(:disabled)') &&
      document.querySelector<HTMLButtonElement>('button[aria-label="Face west"]:not(:disabled)'),
  )
}

function spaceIsFinishTurnShortcut(): boolean {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
  )
  const finish = buttons.find(
    (button) => button.querySelector(':scope > strong')?.textContent?.trim() === 'Finish Turn',
  )
  const shortcut = finish?.querySelector<HTMLElement>(':scope > span')?.textContent?.trim() ?? ''
  return /^Space(?:\s|·|$)/i.test(shortcut)
}

function currentFacingButton(playerName: string): HTMLButtonElement | null {
  const tile = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).find((candidate) =>
    (candidate.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
  )
  if (!tile) return null

  const value = tile.querySelector<HTMLElement>(
    '[data-battle-facing-indicator="true"]',
  )?.dataset.facing
  const facing: Facing | null =
    value === 'north' || value === 'east' || value === 'south' || value === 'west' ? value : null
  return facing
    ? document.querySelector<HTMLButtonElement>(`button[aria-label="Face ${facing}"]`)
    : null
}

/**
 * Restores the desktop AI keyboard contract for Finish Turn:
 * first Space opens Final Facing; a second Space commits the actor's existing facing.
 *
 * This lives ahead of the shared keyboard assist in the capture phase so only the second-stage
 * same-facing shortcut is intercepted. The first Space, WASD facing choices, custom keybinds,
 * mobile behavior, PvP behavior, and the server-authoritative final-turn handler remain untouched.
 */
export function AiDesktopSameFacingKeyboardAssist({ playerName }: { playerName: string }) {
  useLayoutEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isTextEntryTarget(event.target) ||
        !desktopAiBattleIsActive() ||
        !finalFacingModeIsActive() ||
        !spaceIsFinishTurnShortcut()
      ) {
        return
      }

      const facing = currentFacingButton(playerName)
      if (!facing || facing.disabled) return

      event.preventDefault()
      event.stopImmediatePropagation()
      facing.click()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [playerName])

  return null
}
