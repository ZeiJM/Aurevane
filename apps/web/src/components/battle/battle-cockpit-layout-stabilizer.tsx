'use client'

import { useEffect, useRef } from 'react'

import styles from './battle-cockpit-layout-stabilizer.module.css'

const MOBILE_QUERY = '(max-width: 820px)'
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

function hideFacingPads() {
  document
    .querySelectorAll<HTMLElement>('[data-unified-facing-pad="true"]')
    .forEach((pad) => pad.style.setProperty('display', 'none', 'important'))
}

function syncFinishTurnCopy() {
  hideFacingPads()

  const deck = document.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
  if (!deck) return
  const button = Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) =>
      candidate.querySelector(':scope > strong')?.textContent?.trim() === 'Finish Turn',
  )
  const cost = button?.querySelector<HTMLElement>(':scope > small')
  const copy = window.matchMedia(MOBILE_QUERY).matches ? 'Choose facing + end' : 'Keep facing + end'
  if (cost && cost.textContent !== copy) cost.textContent = copy
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
      if (!button || button.disabled || window.matchMedia(MOBILE_QUERY).matches) return

      if (queuedFrame.current !== 0) window.cancelAnimationFrame(queuedFrame.current)
      if (retryFrame.current !== 0) window.cancelAnimationFrame(retryFrame.current)

      // Desktop keeps its compact one-click current-facing shortcut. Mobile deliberately stops here:
      // its native click only enters facing mode so the battlefield guides can be double-tapped, while
      // BattleFacingQuickCommitAssist owns the separate double-tap Finish Turn shortcut.
      queuedFrame.current = window.requestAnimationFrame(() => {
        queuedFrame.current = 0
        hideFacingPads()
        commitCurrentFacing()
      })
    }

    syncFinishTurnCopy()
    const observer = new MutationObserver(syncFinishTurnCopy)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-open'],
      childList: true,
      subtree: true,
    })
    const media = window.matchMedia(MOBILE_QUERY)
    media.addEventListener('change', syncFinishTurnCopy)
    document.addEventListener('click', handleClick, true)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', syncFinishTurnCopy)
      document.removeEventListener('click', handleClick, true)
      if (queuedFrame.current !== 0) window.cancelAnimationFrame(queuedFrame.current)
      if (retryFrame.current !== 0) window.cancelAnimationFrame(retryFrame.current)
    }
  }, [playerName])

  return null
}
