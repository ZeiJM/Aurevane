'use client'

import { useEffect, useRef } from 'react'

import styles from './battle-facing-quick-commit-assist.module.css'

const DOUBLE_TAP_WINDOW_MS = 750
const SYNTHETIC_CLICK_SUPPRESS_MS = 650
const FACING_GLYPHS = {
  north: '↑',
  east: '→',
  south: '↓',
  west: '←',
} as const

type Facing = keyof typeof FACING_GLYPHS

function finalFacingButton(target: EventTarget | null): HTMLButtonElement | null {
  const element = target instanceof Element ? target : null
  return element?.closest<HTMLButtonElement>('button[aria-label^="Face "]') ?? null
}

function facingGuide(target: EventTarget | null): HTMLElement | null {
  const element = target instanceof Element ? target : null
  return element?.closest<HTMLElement>('[data-facing-guide="true"]') ?? null
}

function facingFromGuide(guide: HTMLElement): Facing | null {
  const value = guide.dataset.facingDirection
  return value === 'north' || value === 'east' || value === 'south' || value === 'west'
    ? value
    : null
}

function rememberAndSet(element: HTMLElement, value: string) {
  if (element.dataset.facingPreviewOriginal === undefined) {
    element.dataset.facingPreviewOriginal = element.textContent ?? ''
  }
  element.dataset.facingPreview = 'true'
  element.textContent = value
}

function restoreFacingPreview() {
  for (const element of document.querySelectorAll<HTMLElement>('[data-facing-preview="true"]')) {
    element.textContent = element.dataset.facingPreviewOriginal ?? element.textContent
    delete element.dataset.facingPreview
    delete element.dataset.facingPreviewOriginal
  }
}

function keepFacingPreview() {
  for (const element of document.querySelectorAll<HTMLElement>('[data-facing-preview="true"]')) {
    delete element.dataset.facingPreview
    delete element.dataset.facingPreviewOriginal
  }
}

function applyFacingPreview(playerName: string, facing: Facing) {
  restoreFacingPreview()
  const glyph = FACING_GLYPHS[facing]

  const tile = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).find((candidate) =>
    (candidate.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
  )

  const tileIndicator = tile
    ? Array.from(tile.querySelectorAll<HTMLElement>('i, span')).find((candidate) =>
        Object.values(FACING_GLYPHS).includes(
          candidate.textContent?.trim() as (typeof FACING_GLYPHS)[Facing],
        ),
      )
    : null
  if (tileIndicator) rememberAndSet(tileIndicator, glyph)

  const summaryRoots = [
    ...document.querySelectorAll<HTMLElement>('aside[aria-label$=" combat status"]'),
    ...document.querySelectorAll<HTMLElement>('aside[aria-label$=" battle summary"]'),
  ].filter((candidate) => {
    const label = candidate.getAttribute('aria-label') ?? ''
    return label === `${playerName} combat status` || label === `${playerName} battle summary`
  })

  for (const root of summaryRoots) {
    const direction = Array.from(root.querySelectorAll<HTMLElement>('strong')).find((candidate) =>
      ['north', 'east', 'south', 'west'].includes(candidate.textContent?.trim().toLowerCase() ?? ''),
    )
    if (direction) rememberAndSet(direction, facing)

    const indicator = Array.from(root.querySelectorAll<HTMLElement>('span')).find((candidate) =>
      Object.values(FACING_GLYPHS).includes(
        candidate.textContent?.trim() as (typeof FACING_GLYPHS)[Facing],
      ),
    )
    if (indicator) rememberAndSet(indicator, glyph)
  }
}

function clearSelection(options?: { restorePreview?: boolean }) {
  for (const element of document.querySelectorAll<HTMLElement>('[data-facing-quick-selected="true"]')) {
    element.removeAttribute('data-facing-quick-selected')
    element.removeAttribute('aria-pressed')
  }
  if (options?.restorePreview === false) keepFacingPreview()
  else restoreFacingPreview()
}

export function BattleFacingQuickCommitAssist({ playerName }: { playerName: string }) {
  const lastGuideSelection = useRef<{ facing: Facing; at: number } | null>(null)
  const suppressSyntheticClickUntil = useRef(0)

  useEffect(() => {
    void styles

    function selectGuide(guide: HTMLElement, facing: Facing, now: number) {
      clearSelection()
      guide.dataset.facingQuickSelected = 'true'
      guide.setAttribute('aria-pressed', 'true')
      applyFacingPreview(playerName, facing)
      lastGuideSelection.current = { facing, at: now }
    }

    function commitGuide(facing: Facing) {
      const control = document.querySelector<HTMLButtonElement>(`button[aria-label="Face ${facing}"]`)
      if (!control || control.disabled) return
      clearSelection({ restorePreview: false })
      lastGuideSelection.current = null
      // The real Final Facing button owns the server-authoritative final-turn commit. The map guide
      // simply invokes that same path after the second tap/click.
      control.click()
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
      const guide = facingGuide(event.target)
      if (!guide) return
      const facing = facingFromGuide(guide)
      if (!facing) return
      const control = document.querySelector<HTMLButtonElement>(`button[aria-label="Face ${facing}"]`)
      if (!control || control.disabled) return

      event.preventDefault()
      event.stopImmediatePropagation()
      suppressSyntheticClickUntil.current = Date.now() + SYNTHETIC_CLICK_SUPPRESS_MS

      const now = Date.now()
      const previous = lastGuideSelection.current
      const sameDirection =
        previous !== null &&
        previous.facing === facing &&
        now - previous.at <= DOUBLE_TAP_WINDOW_MS

      if (sameDirection) {
        commitGuide(facing)
        return
      }

      selectGuide(guide, facing, now)
    }

    function handleClick(event: MouseEvent) {
      const guide = facingGuide(event.target)
      if (guide) {
        const facing = facingFromGuide(guide)
        if (!facing) return
        const control = document.querySelector<HTMLButtonElement>(`button[aria-label="Face ${facing}"]`)
        if (!control || control.disabled) return

        event.preventDefault()
        event.stopImmediatePropagation()

        // Mobile browsers often synthesize a click after pointerup. Ignore it because the touch
        // gesture was already handled directly above.
        if (Date.now() <= suppressSyntheticClickUntil.current) return

        const now = Date.now()
        const previous = lastGuideSelection.current
        const sameDirection =
          previous !== null &&
          previous.facing === facing &&
          now - previous.at <= DOUBLE_TAP_WINDOW_MS

        if (sameDirection) {
          commitGuide(facing)
          return
        }

        selectGuide(guide, facing, now)
        return
      }

      // Dedicated Final Facing controls are deliberately untouched: one native click/tap chooses
      // the direction and immediately ends the round through the battle component's real handler.
      if (finalFacingButton(event.target)) {
        clearSelection({ restorePreview: false })
        lastGuideSelection.current = null
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (finalFacingButton(event.target) || facingGuide(event.target)) return
      if (!lastGuideSelection.current) return
      clearSelection()
      lastGuideSelection.current = null
    }

    const observer = new MutationObserver(() => {
      if (!document.querySelector('button[aria-label^="Face "]:not(:disabled)')) {
        clearSelection()
        lastGuideSelection.current = null
      }
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    document.addEventListener('pointerup', handlePointerUp, true)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
      clearSelection()
    }
  }, [playerName])

  return null
}
