'use client'

import { useEffect } from 'react'

function isInspectActive(deck: HTMLElement): boolean {
  return Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).some((button) => {
    const label = button.querySelector(':scope > strong')?.textContent?.trim()
    return (
      label === 'Inspect' &&
      (button.hasAttribute('data-active') || button.dataset.battleActive === 'true')
    )
  })
}

function instructionRow(deck: HTMLElement): HTMLElement | null {
  return (
    deck.querySelector<HTMLElement>('[data-battle-instruction-row="true"]') ??
    deck.querySelector<HTMLElement>('[data-testid="combat-mode-instruction"]') ??
    (deck.firstElementChild instanceof HTMLElement ? deck.firstElementChild : null)
  )
}

function directDescription(row: HTMLElement): HTMLElement | null {
  return (
    Array.from(row.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLSpanElement &&
        !child.hasAttribute('data-battle-target-preview') &&
        !child.hasAttribute('data-ai-turn-clock') &&
        !child.hasAttribute('data-pvp-turn-clock') &&
        !child.hasAttribute('data-pvp-opponent-turn-clock'),
    ) ?? null
  )
}

export function describeTerrainLabel(label: string): {
  title: string
  description: string
} | null {
  const match = /^Tile (\d+), (\d+); ([^;]+); elevation (\d+)/.exec(label)
  if (!match) return null

  const [, x, y, terrainId, elevation] = match
  const elevationLevel = Number(elevation)
  const rough = terrainId === 'rough-ground'
  const elevated = elevationLevel > 0
  const terrainName = elevated ? 'Elevated ground' : rough ? 'Rough ground' : 'Open ground'
  const entryCost = rough ? 50 : 25

  return {
    title: `${terrainName} · Tile ${x},${y}`,
    description: `Entry costs ${entryCost} AP · Elevation ${elevationLevel}.`,
  }
}

/**
 * Keeps Inspect terrain feedback on the canonical battle presentation without
 * reintroducing a PvE-only renderer. This is presentation-only: it never
 * intercepts the tile click or changes authoritative battle state.
 */
export function BattleInspectTerrainContext() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('main[data-unified-battle="true"]')
    if (!root) return

    let frame = 0

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const tile = target?.closest<HTMLButtonElement>('button[aria-label^="Tile "]') ?? null
      if (!tile || !root.contains(tile)) return
      if (tile.getAttribute('aria-label')?.includes('occupied by')) return

      const deck = root.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
      if (!deck || !isInspectActive(deck)) return

      const terrain = describeTerrainLabel(tile.getAttribute('aria-label') ?? '')
      if (!terrain) return

      if (frame !== 0) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const row = instructionRow(deck)
        if (!row) return
        const title = row.querySelector<HTMLElement>(':scope > strong')
        const description = directDescription(row)
        if (title) title.textContent = terrain.title
        if (description) description.textContent = terrain.description
      })
    }

    root.addEventListener('click', handleClick)
    return () => {
      root.removeEventListener('click', handleClick)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
