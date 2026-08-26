'use client'

import { useEffect } from 'react'

import terrainStyles from './ai-terrain-legend-pvp-parity.module.css'
import styles from './ai-battle-pvp-visual-sync.module.css'

const COMMAND_LABELS = new Set([
  'Inspect',
  'Move',
  'Basic Attack',
  'Guard',
  'Recover',
  'Finish Turn',
])

function directNumericMarker(tile: HTMLButtonElement): HTMLSpanElement | null {
  for (const child of Array.from(tile.children)) {
    if (!(child instanceof HTMLSpanElement)) continue
    const text = child.textContent?.trim() ?? ''
    if (/^\d+$/.test(text)) return child
  }
  return null
}

function directUnitToken(tile: HTMLButtonElement): HTMLSpanElement | null {
  return (
    Array.from(tile.children).find(
      (child): child is HTMLSpanElement =>
        child instanceof HTMLSpanElement && Boolean(child.querySelector(':scope > strong')),
    ) ?? null
  )
}

function cleanPathZeroMarker(marker: HTMLSpanElement) {
  marker.querySelector('[data-map-token-portrait]')?.remove()
  delete marker.dataset.mapPortraitReady
}

function syncTerrainLegend(battlefield: HTMLElement) {
  const existing = battlefield.querySelector<HTMLElement>(
    ':scope > [data-ai-terrain-legend="true"]',
  )
  const legacy = Array.from(battlefield.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      (child.textContent?.includes('legal/reachable') ?? false) &&
      (child.textContent?.includes('rough = 50 AP') ?? false),
  )
  const legend = existing ?? legacy ?? null
  if (!legend) return

  battlefield.dataset.aiTerrainLayout = 'true'
  legend.dataset.aiTerrainLegend = 'true'
  legend.setAttribute('aria-label', 'Terrain legend')

  const items = Array.from(legend.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  )
  items[0]?.setAttribute('aria-label', 'Difficult Ground. Higher movement cost.')
  items[1]?.setAttribute('aria-label', 'Raised Ground. Elevation plus one.')
  for (const item of items.slice(2)) item.setAttribute('aria-hidden', 'true')
}

export function AiBattlePvpVisualSync({ playerName }: { playerName: string }) {
  useEffect(() => {
    let frame: number | null = null

    const sync = () => {
      frame = null
      const battlefield = document.querySelector<HTMLElement>(
        'section[aria-label="Tactical battlefield"]',
      )
      const root = battlefield?.closest<HTMLElement>('main') ?? null
      if (!root || root.dataset.pvpBattle === 'true') return

      const commandDeck = root.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
      if (commandDeck) {
        commandDeck.dataset.aiPvpVisualSync = 'true'

        const facingButtons: HTMLButtonElement[] = []
        for (const button of commandDeck.querySelectorAll<HTMLButtonElement>('button')) {
          const label =
            button.querySelector<HTMLElement>(':scope > strong')?.textContent?.trim() ?? ''
          if (COMMAND_LABELS.has(label)) {
            button.dataset.aiCommandButton = 'true'
            if (button.className.trim()) button.dataset.selected = 'true'
            else delete button.dataset.selected
          }

          if (button.getAttribute('aria-label')?.startsWith('Face ')) {
            button.dataset.aiFacingButton = 'true'
            facingButtons.push(button)
          }
        }

        const facingPad = facingButtons[0]?.parentElement
        if (facingPad instanceof HTMLElement) facingPad.dataset.aiFacingPad = 'true'
      }

      if (!battlefield) return
      syncTerrainLegend(battlefield)

      const tiles = Array.from(
        battlefield.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]'),
      )
      let pathActive = false

      for (const tile of tiles) {
        const marker = directNumericMarker(tile)
        if (marker && marker.dataset.aiPathZero !== 'true') {
          marker.dataset.aiPathNumber = 'true'
          tile.dataset.aiPathTile = 'true'
          pathActive = true
        } else if (!marker) {
          delete tile.dataset.aiPathTile
        }
      }

      const existingZero = battlefield.querySelector<HTMLSpanElement>('[data-ai-path-zero="true"]')
      if (!pathActive) {
        existingZero?.remove()
        return
      }

      const playerTile = tiles.find((tile) =>
        tile.getAttribute('aria-label')?.includes(`occupied by ${playerName}`),
      )
      if (!playerTile) return

      playerTile.dataset.aiPathTile = 'true'
      const unitToken = directUnitToken(playerTile)
      if (!existingZero || existingZero.parentElement !== playerTile) {
        existingZero?.remove()
        const zero = document.createElement('span')
        zero.textContent = '0'
        zero.dataset.aiPathNumber = 'true'
        zero.dataset.aiPathZero = 'true'
        zero.setAttribute('aria-hidden', 'true')
        playerTile.insertBefore(zero, unitToken)
      } else {
        cleanPathZeroMarker(existingZero)
        if (unitToken && existingZero.nextElementSibling !== unitToken) {
          playerTile.insertBefore(existingZero, unitToken)
        }
      }
    }

    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'disabled'],
    })

    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      document.querySelector('[data-ai-path-zero="true"]')?.remove()
      const battlefield = document.querySelector<HTMLElement>(
        'section[aria-label="Tactical battlefield"]',
      )
      if (battlefield?.dataset.pvpBattle !== 'true') delete battlefield?.dataset.aiTerrainLayout
    }
  }, [playerName])

  return <span className={`${styles.hook} ${terrainStyles.hook}`} aria-hidden="true" />
}
