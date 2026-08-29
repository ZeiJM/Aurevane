'use client'

import { useEffect } from 'react'

import styles from './battle-terrain-presentation-polish.module.css'

const TERRAIN_TERMINOLOGY = new Map([
  ['Difficult Ground', 'Difficult Terrain'],
  ['Raised Ground', 'Elevated Ground'],
])

function readElevation(tile: HTMLElement): number {
  const match = (tile.getAttribute('aria-label') ?? '').match(/elevation\s+(\d+)/i)
  return match ? Number(match[1]) : 0
}

function syncLegendTerminology(battlefield: HTMLElement): void {
  for (const key of battlefield.querySelectorAll<HTMLElement>("[aria-label='Terrain legend'] > span")) {
    const label = key.querySelector<HTMLElement>('b')
    if (!label) continue

    const current = label.textContent?.trim() ?? ''
    const replacement = TERRAIN_TERMINOLOGY.get(current)
    if (replacement && label.textContent !== replacement) label.textContent = replacement

    const resolvedLabel = replacement ?? current
    if (resolvedLabel === 'Elevated Ground') {
      const description = key.querySelector<HTMLElement>('small')
      if (description && description.textContent !== 'Access depends on Jump') {
        description.textContent = 'Access depends on Jump'
      }
    }
  }
}

function directCombatantToken(tile: HTMLElement): HTMLElement | null {
  return (
    Array.from(tile.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.matches('span') &&
        Boolean(child.querySelector(':scope > strong')),
    ) ?? null
  )
}

function ensureElevationMarker(tile: HTMLElement, elevation: number): void {
  const existing = tile.querySelector<HTMLElement>(
    ':scope > [data-terrain-elevation-marker="true"]',
  )

  if (elevation <= 0) {
    existing?.remove()
    return
  }

  let marker = existing
  if (!marker || marker.tagName !== 'I') {
    existing?.remove()
    marker = document.createElement('i')
    marker.dataset.terrainElevationMarker = 'true'
    marker.setAttribute('aria-hidden', 'true')
  }

  const cue = `▲${elevation}`
  if (marker.textContent !== cue) marker.textContent = cue

  const token = directCombatantToken(tile)
  if (token) {
    if (marker.parentElement !== tile || marker.nextElementSibling !== token) {
      tile.insertBefore(marker, token)
    }
  } else if (marker.parentElement !== tile) {
    tile.append(marker)
  }
}

function syncTilePresentation(battlefield: HTMLElement): void {
  for (const tile of battlefield.querySelectorAll<HTMLElement>("button[aria-label^='Tile ']")) {
    const label = tile.getAttribute('aria-label') ?? ''
    const difficult =
      tile.dataset.terrain === 'rough' ||
      label.includes('; rough-ground;') ||
      label.includes('; rough ground;') ||
      label.includes('; difficult terrain;')
    const elevation = readElevation(tile)

    if (difficult) tile.dataset.terrainPresentation = 'difficult'
    else delete tile.dataset.terrainPresentation

    if (elevation > 0) tile.dataset.terrainElevated = 'true'
    else delete tile.dataset.terrainElevated

    delete tile.dataset.terrainElevationCue
    ensureElevationMarker(tile, elevation)

    for (const candidate of tile.querySelectorAll<HTMLElement>(
      'b, span:not([data-terrain-elevation-marker="true"])',
    )) {
      const text = candidate.textContent?.trim() ?? ''
      if (/^▲\d*$/.test(text)) {
        candidate.dataset.terrainNativeElevation = 'true'
      } else if (candidate.dataset.terrainNativeElevation === 'true') {
        delete candidate.dataset.terrainNativeElevation
      }
    }

    // Keep the native tile aria-label untouched. The visual legend uses player-facing terminology,
    // but rewriting React-owned accessibility labels during every presentation pass creates needless
    // reconciliation work and can invalidate selectors during an action commit.
  }
}

function syncTerrainPresentation(battlefield: HTMLElement): void {
  syncLegendTerminology(battlefield)
  syncTilePresentation(battlefield)
}

export function BattleTerrainPresentationPolish() {
  useEffect(() => {
    const battlefield = document.querySelector<HTMLElement>('section#battlefield')
    if (!battlefield) return

    let frame = 0

    const run = () => {
      frame = 0
      syncTerrainPresentation(battlefield)
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(run)
    }

    run()
    const observer = new MutationObserver(schedule)
    observer.observe(battlefield, { childList: true, subtree: true, characterData: true })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      for (const marker of battlefield.querySelectorAll<HTMLElement>(
        '[data-terrain-elevation-marker="true"]',
      )) {
        marker.remove()
      }
    }
  }, [])

  return <span className={styles.hook} aria-hidden="true" />
}
