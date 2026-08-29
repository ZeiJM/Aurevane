'use client'

import { useEffect } from 'react'

import coordinateStyles from './battle-coordinate-toggle.module.css'
import styles from './battle-terrain-presentation-polish.module.css'

const TERRAIN_TERMINOLOGY = new Map([
  ['Difficult Ground', 'Difficult Terrain'],
  ['Raised Ground', 'Elevated Ground'],
])

function readElevation(tile: HTMLElement): number {
  const match = (tile.getAttribute('aria-label') ?? '').match(/elevation\s+(\d+)/i)
  return match ? Number(match[1]) : 0
}

function syncLegendTerminology(): void {
  for (const key of document.querySelectorAll<HTMLElement>(
    "[aria-label='Terrain legend'] > span",
  )) {
    const label = key.querySelector<HTMLElement>('b')
    if (!label) continue

    const current = label.textContent?.trim() ?? ''
    const replacement = TERRAIN_TERMINOLOGY.get(current)
    if (replacement) label.textContent = replacement

    const resolvedLabel = replacement ?? current
    if (resolvedLabel === 'Elevated Ground') {
      const description = key.querySelector<HTMLElement>('small')
      if (description) description.textContent = 'Access depends on Jump'
    }
  }
}

function syncCoordinateToggleState(toggle: HTMLButtonElement, showCoordinates: boolean): void {
  toggle.setAttribute('aria-checked', String(showCoordinates))
  toggle.title = `Tile coordinates: ${showCoordinates ? 'on' : 'off'}`
}

function syncCoordinateToggle(): void {
  for (const battlefield of document.querySelectorAll<HTMLElement>('section#battlefield')) {
    const legend = battlefield.querySelector<HTMLElement>(":scope > [aria-label='Terrain legend']")
    if (!legend) continue

    let toggle = legend.querySelector<HTMLButtonElement>(
      ":scope > button[data-terrain-coordinate-toggle='true']",
    )

    if (!toggle) {
      const createdToggle = document.createElement('button')
      createdToggle.type = 'button'
      createdToggle.className = coordinateStyles.coordinateToggle
      createdToggle.dataset.terrainCoordinateToggle = 'true'
      createdToggle.setAttribute('role', 'switch')
      createdToggle.setAttribute('aria-label', 'Tile coordinates')

      const label = document.createElement('span')
      label.textContent = 'Coords'

      const track = document.createElement('i')
      track.setAttribute('aria-hidden', 'true')

      createdToggle.append(track, label)
      createdToggle.addEventListener('click', () => {
        const showCoordinates = battlefield.dataset.showCoordinates !== 'true'
        if (showCoordinates) battlefield.dataset.showCoordinates = 'true'
        else delete battlefield.dataset.showCoordinates
        syncCoordinateToggleState(createdToggle, showCoordinates)
      })
      legend.append(createdToggle)
      toggle = createdToggle
    }

    syncCoordinateToggleState(toggle, battlefield.dataset.showCoordinates === 'true')
  }
}

function clearCoordinateToggle(): void {
  for (const battlefield of document.querySelectorAll<HTMLElement>('section#battlefield')) {
    delete battlefield.dataset.showCoordinates
  }

  for (const toggle of document.querySelectorAll<HTMLButtonElement>(
    "button[data-terrain-coordinate-toggle='true']",
  )) {
    toggle.remove()
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

  // The battlefield's established token-polish routines intentionally use a direct `span:last-child`
  // contract to identify combatant tokens. A span-based elevation marker can therefore be mistaken
  // for a token during refresh/hydration and receive persistent inline centering styles. Make the
  // elevation cue structurally impossible to match that contract by using a dedicated <i> element.
  let marker = existing
  if (!marker || marker.tagName !== 'I') {
    existing?.remove()
    marker = document.createElement('i')
    marker.dataset.terrainElevationMarker = 'true'
    marker.setAttribute('aria-hidden', 'true')
  }

  const cue = `▲${elevation}`
  if (marker.textContent !== cue) marker.textContent = cue

  // Preserve the combatant token as the tile's final direct span for all existing helpers. The
  // marker remains a sibling owned only by terrain presentation and never participates in hit tests.
  const token = directCombatantToken(tile)
  if (token) {
    if (marker.parentElement !== tile || marker.nextElementSibling !== token) {
      tile.insertBefore(marker, token)
    }
  } else if (marker.parentElement !== tile) {
    tile.append(marker)
  }
}

function syncTilePresentation(): void {
  for (const tile of document.querySelectorAll<HTMLElement>(
    "section#battlefield button[aria-label^='Tile ']",
  )) {
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

    if (difficult) {
      tile.setAttribute(
        'aria-label',
        label
          .replace('; rough-ground;', '; difficult terrain;')
          .replace('; rough ground;', '; difficult terrain;'),
      )
    }
  }
}

function syncTerrainPresentation(): void {
  syncLegendTerminology()
  syncCoordinateToggle()
  syncTilePresentation()
}

export function BattleTerrainPresentationPolish() {
  useEffect(() => {
    let frame = 0

    const run = () => {
      frame = 0
      syncTerrainPresentation()
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(run)
    }

    run()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      clearCoordinateToggle()
      for (const marker of document.querySelectorAll<HTMLElement>(
        '[data-terrain-elevation-marker="true"]',
      )) {
        marker.remove()
      }
    }
  }, [])

  return <span className={styles.hook} aria-hidden="true" />
}
