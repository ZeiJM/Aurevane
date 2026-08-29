'use client'

import { useLayoutEffect } from 'react'

import { BattleKeyboardAssist } from './battle-keyboard-assist'

type Facing = 'north' | 'east' | 'south' | 'west'

interface KeyEventShape {
  code: string
  repeat: boolean
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function facingFromGlyph(text: string): Facing | null {
  if (text.includes('↑')) return 'north'
  if (text.includes('→')) return 'east'
  if (text.includes('↓')) return 'south'
  if (text.includes('←')) return 'west'
  return null
}

export function currentFacingControlLabel(glyphTexts: readonly string[]): string | null {
  for (const text of glyphTexts) {
    const facing = facingFromGlyph(text)
    if (facing) return `Face ${facing}`
  }
  return null
}

export function isCurrentFacingFinishKey(event: KeyEventShape): boolean {
  return (
    event.code === 'Space' &&
    !event.repeat &&
    !event.shiftKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  )
}

function desktopAiBattleAvailable(): boolean {
  return (
    window.matchMedia('(min-width: 821px)').matches &&
    Boolean(document.querySelector('#battlefield')) &&
    !document.querySelector("main[data-pvp-battle='true']")
  )
}

function finalFacingModeIsActive(): boolean {
  return Boolean(
    document.querySelector<HTMLButtonElement>('[aria-label="Face north"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face south"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face west"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face east"]:not(:disabled)'),
  )
}

function currentFacingControl(playerName: string): HTMLButtonElement | null {
  const tile = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).find((candidate) =>
    (candidate.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
  )
  if (!tile) return null

  const label = currentFacingControlLabel(
    Array.from(tile.querySelectorAll<HTMLElement>('i, span')).map(
      (candidate) => candidate.textContent?.trim() ?? '',
    ),
  )
  return label ? document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) : null
}

/**
 * AI desktop keeps the familiar two-press turn finish: the first Space enters Final Facing through
 * BattleKeyboardAssist; the second Space commits the player's already-current facing direction.
 * This listener is registered in a layout effect so it runs before the existing passive keyboard
 * listener once Final Facing is active. Holding Space does not count as the second press.
 */
export function AiBattleKeyboardAssist({ playerName }: { playerName: string }) {
  useLayoutEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !desktopAiBattleAvailable() ||
        isTextEntryTarget(event.target) ||
        !isCurrentFacingFinishKey(event) ||
        !finalFacingModeIsActive()
      ) {
        return
      }

      const control = currentFacingControl(playerName)
      if (!control || control.disabled) return

      event.preventDefault()
      event.stopImmediatePropagation()
      control.click()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [playerName])

  return <BattleKeyboardAssist playerName={playerName} />
}
