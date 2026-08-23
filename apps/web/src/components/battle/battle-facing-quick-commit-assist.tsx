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

type CurrentFacingShortcut = 'finish-command' | 'facing-center'

function finalFacingButton(target: EventTarget | null): HTMLButtonElement | null {
  const element = target instanceof Element ? target : null
  return element?.closest<HTMLButtonElement>('button[aria-label^="Face "]') ?? null
}

function finishTurnButton(target: EventTarget | null): HTMLButtonElement | null {
  const element = target instanceof Element ? target : null
  const button = element?.closest<HTMLButtonElement>('section[aria-label="Command Deck"] button') ?? null
  return button?.querySelector('strong')?.textContent?.trim() === 'Finish Turn' ? button : null
}

function facingPadCenter(target: EventTarget | null): HTMLElement | null {
  const element = target instanceof Element ? target : null
  const pad = element?.closest<HTMLElement>('[data-pvp-facing-pad="true"]') ?? null
  if (!pad || element?.closest('button') || element?.closest(':scope > span')) return null
  return pad
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

function facingFromGlyph(glyph: string): Facing | null {
  if (glyph.includes(FACING_GLYPHS.north)) return 'north'
  if (glyph.includes(FACING_GLYPHS.east)) return 'east'
  if (glyph.includes(FACING_GLYPHS.south)) return 'south'
  if (glyph.includes(FACING_GLYPHS.west)) return 'west'
  return null
}

function currentFacingControl(playerName: string): HTMLButtonElement | null {
  const tile = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).find((candidate) =>
    (candidate.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
  )
  if (!tile) return null

  const glyph = Array.from(tile.querySelectorAll<HTMLElement>('i, span'))
    .map((candidate) => candidate.textContent?.trim() ?? '')
    .find((text) => facingFromGlyph(text) !== null)
  const facing = glyph ? facingFromGlyph(glyph) : null
  return facing
    ? document.querySelector<HTMLButtonElement>(`button[aria-label="Face ${facing}"]`)
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
      ['north', 'east', 'south', 'west'].includes(
        candidate.textContent?.trim().toLowerCase() ?? '',
      ),
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
  for (const element of document.querySelectorAll<HTMLElement>(
    '[data-facing-quick-selected="true"]',
  )) {
    element.removeAttribute('data-facing-quick-selected')
    element.removeAttribute('aria-pressed')
  }
  if (options?.restorePreview === false) keepFacingPreview()
  else restoreFacingPreview()
}

export function BattleFacingQuickCommitAssist({ playerName }: { playerName: string }) {
  const lastGuideSelection = useRef<{ facing: Facing; at: number } | null>(null)
  const lastCurrentFacingTap = useRef<{ key: CurrentFacingShortcut; at: number } | null>(null)
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
      const control = document.querySelector<HTMLButtonElement>(
        `button[aria-label="Face ${facing}"]`,
      )
      if (!control || control.disabled) return
      clearSelection({ restorePreview: false })
      lastGuideSelection.current = null
      lastCurrentFacingTap.current = null
      // The real Final Facing button owns the server-authoritative final-turn commit. The map guide
      // simply invokes that same path after the second tap/click.
      control.click()
    }

    function handleCurrentFacingShortcut(
      event: PointerEvent,
      key: CurrentFacingShortcut,
    ): boolean {
      const now = Date.now()
      const previous = lastCurrentFacingTap.current
      const secondTap = previous?.key === key && now - previous.at <= DOUBLE_TAP_WINDOW_MS

      if (!secondTap) {
        lastCurrentFacingTap.current = { key, at: now }
        return false
      }

      const control = currentFacingControl(playerName)
      if (!control || control.disabled) {
        lastCurrentFacingTap.current = { key, at: now }
        return false
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      suppressSyntheticClickUntil.current = now + SYNTHETIC_CLICK_SUPPRESS_MS
      lastCurrentFacingTap.current = null
      clearSelection({ restorePreview: false })
      control.click()
      return true
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return

      if (finishTurnButton(event.target)) {
        handleCurrentFacingShortcut(event, 'finish-command')
        return
      }

      if (facingPadCenter(event.target)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        handleCurrentFacingShortcut(event, 'facing-center')
        return
      }

      const guide = facingGuide(event.target)
      if (!guide) return
      const facing = facingFromGuide(guide)
      if (!facing) return
      const control = document.querySelector<HTMLButtonElement>(
        `button[aria-label="Face ${facing}"]`,
      )
      if (!control || control.disabled) return

      event.preventDefault()
      event.stopImmediatePropagation()
      suppressSyntheticClickUntil.current = Date.now() + SYNTHETIC_CLICK_SUPPRESS_MS

      const now = Date.now()
      const previous = lastGuideSelection.current
      const sameDirection =
        previous !== null && previous.facing === facing && now - previous.at <= DOUBLE_TAP_WINDOW_MS

      if (sameDirection) {
        commitGuide(facing)
        return
      }

      selectGuide(guide, facing, now)
    }

    function handleClick(event: MouseEvent) {
      const finish = finishTurnButton(event.target)
      const center = facingPadCenter(event.target)
      if ((finish || center) && Date.now() <= suppressSyntheticClickUntil.current) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }

      const guide = facingGuide(event.target)
      if (guide) {
        const facing = facingFromGuide(guide)
        if (!facing) return
        const control = document.querySelector<HTMLButtonElement>(
          `button[aria-label="Face ${facing}"]`,
        )
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
        lastCurrentFacingTap.current = null
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        finalFacingButton(event.target) ||
        facingGuide(event.target) ||
        finishTurnButton(event.target) ||
        facingPadCenter(event.target)
      ) {
        return
      }
      if (!lastGuideSelection.current && !lastCurrentFacingTap.current) return
      clearSelection()
      lastGuideSelection.current = null
      lastCurrentFacingTap.current = null
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
