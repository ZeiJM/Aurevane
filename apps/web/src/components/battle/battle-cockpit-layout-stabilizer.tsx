'use client'

import { useEffect, useRef } from 'react'

import styles from './battle-cockpit-layout-stabilizer.module.css'

const FACING_GLYPHS = {
  north: '↑',
  east: '→',
  south: '↓',
  west: '←',
} as const

type Facing = keyof typeof FACING_GLYPHS

function facingFromGlyph(glyph: string): Facing | null {
  if (glyph.includes(FACING_GLYPHS.north)) return 'north'
  if (glyph.includes(FACING_GLYPHS.east)) return 'east'
  if (glyph.includes(FACING_GLYPHS.south)) return 'south'
  if (glyph.includes(FACING_GLYPHS.west)) return 'west'
  return null
}

function finishTurnButton(target: EventTarget | null): HTMLButtonElement | null {
  const element = target instanceof Element ? target : null
  const button =
    element?.closest<HTMLButtonElement>('section[aria-label="Command Deck"] button') ?? null
  return button?.querySelector(':scope > strong')?.textContent?.trim() === 'Finish Turn'
    ? button
    : null
}

function currentFacingControl(playerName: string): HTMLButtonElement | null {
  const tile = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).find((candidate) =>
    (candidate.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
  )
  if (!tile) return null

  const facingGlyph = Array.from(tile.querySelectorAll<HTMLElement>('i, span'))
    .map((candidate) => candidate.textContent?.trim() ?? '')
    .find((text) => facingFromGlyph(text) !== null)
  const facing = facingGlyph ? facingFromGlyph(facingGlyph) : null
  return facing
    ? document.querySelector<HTMLButtonElement>(`button[aria-label="Face ${facing}"]`)
    : null
}

function syncFinishTurnCopy() {
  const deck = document.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
  if (!deck) return
  const button = Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) =>
      candidate.querySelector(':scope > strong')?.textContent?.trim() === 'Finish Turn',
  )
  const cost = button?.querySelector<HTMLElement>(':scope > small')
  if (cost && cost.textContent !== 'Keep facing + end') cost.textContent = 'Keep facing + end'
}

export function BattleCockpitLayoutStabilizer({ playerName }: { playerName: string }) {
  const queuedFrame = useRef(0)
  const retryFrame = useRef(0)

  useEffect(() => {
    void styles

    const commitCurrentFacing = (retry = false) => {
      const control = currentFacingControl(playerName)
      if (control && !control.disabled) {
        control.click()
        return
      }
      if (!retry) {
        retryFrame.current = window.requestAnimationFrame(() => commitCurrentFacing(true))
      }
    }

    const handleClick = (event: MouseEvent) => {
      const button = finishTurnButton(event.target)
      if (!button || button.disabled) return

      if (queuedFrame.current !== 0) window.cancelAnimationFrame(queuedFrame.current)
      if (retryFrame.current !== 0) window.cancelAnimationFrame(retryFrame.current)

      // Let the real battle button enter its native finish mode first. On the next frame, invoke the
      // hidden current-facing control so the existing server-authoritative final-turn path remains
      // unchanged while the obsolete directional pad stays out of both desktop and mobile layout.
      queuedFrame.current = window.requestAnimationFrame(() => {
        queuedFrame.current = 0
        commitCurrentFacing()
      })
    }

    syncFinishTurnCopy()
    const observer = new MutationObserver(syncFinishTurnCopy)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('click', handleClick, true)

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
      if (queuedFrame.current !== 0) window.cancelAnimationFrame(queuedFrame.current)
      if (retryFrame.current !== 0) window.cancelAnimationFrame(retryFrame.current)
    }
  }, [playerName])

  return null
}
