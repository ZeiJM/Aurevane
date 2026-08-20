'use client'

import { useEffect } from 'react'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'

const COMBATANT_COLORS = ['#67c98a', '#dc6a66', '#67aee8', '#d9ad5c', '#a984e8', '#df7eb5'] as const

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? ''
}

function tileCoordinates(tile: HTMLButtonElement): { x: number; y: number } | null {
  const match = tile.getAttribute('aria-label')?.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return null
  return { x: Number(match[1]), y: Number(match[2]) }
}

function facingFromGlyph(glyph: string): 'north' | 'east' | 'south' | 'west' | null {
  if (glyph.includes('↑')) return 'north'
  if (glyph.includes('→')) return 'east'
  if (glyph.includes('↓')) return 'south'
  if (glyph.includes('←')) return 'west'
  return null
}

function findFinishButton(root: ParentNode = document): HTMLButtonElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      textOf(button).includes('Finish Turn'),
    ) ?? null
  )
}

function isFinishMode(root: ParentNode = document): boolean {
  const button = findFinishButton(root)
  return Boolean(button?.hasAttribute('data-active') || button?.getAttribute('aria-pressed') === 'true')
}

function findPlayerTile(playerName: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
    ).find((tile) => tile.getAttribute('aria-label')?.includes(`occupied by ${playerName}`)) ?? null
  )
}

function commitCurrentFacing(playerName: string): boolean {
  const tile = findPlayerTile(playerName)
  if (!tile) return false
  const glyph = tile.querySelector<HTMLElement>('i')?.textContent ?? ''
  const facing = facingFromGlyph(glyph)
  if (!facing) return false
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="Face ${facing}"]`)
  if (!button || button.disabled) return false
  button.click()
  return true
}

function clearFacingGuides() {
  for (const tile of document.querySelectorAll<HTMLElement>('[data-facing-guide]')) {
    tile.removeAttribute('data-facing-guide')
    tile.removeAttribute('data-facing-direction')
    tile.querySelector('[data-facing-arrow]')?.remove()
  }
}

function applyFacingGuides(playerName: string) {
  clearFacingGuides()
  if (!isFinishMode()) return
  const origin = findPlayerTile(playerName)
  const coordinates = origin ? tileCoordinates(origin) : null
  if (!origin || !coordinates) return

  const targets = [
    { x: coordinates.x, y: coordinates.y - 1, direction: 'north', glyph: '↑' },
    { x: coordinates.x + 1, y: coordinates.y, direction: 'east', glyph: '→' },
    { x: coordinates.x, y: coordinates.y + 1, direction: 'south', glyph: '↓' },
    { x: coordinates.x - 1, y: coordinates.y, direction: 'west', glyph: '←' },
  ] as const

  const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>('#battlefield button'))
  for (const target of targets) {
    const tile = tiles.find((candidate) => {
      const value = tileCoordinates(candidate)
      return value?.x === target.x && value.y === target.y
    })
    if (!tile) continue
    tile.dataset.facingGuide = 'true'
    tile.dataset.facingDirection = target.direction
    const arrow = document.createElement('span')
    arrow.dataset.facingArrow = 'true'
    arrow.textContent = target.glyph
    arrow.setAttribute('aria-hidden', 'true')
    tile.appendChild(arrow)
  }
}

function polishTerrainLegend() {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  if (!battlefield) return
  const existing = battlefield.querySelector<HTMLElement>('[data-terrain-legend-polish]')
  if (existing) return

  const legend = document.createElement('div')
  legend.dataset.terrainLegendPolish = 'true'
  legend.setAttribute('aria-label', 'Terrain legend')
  legend.innerHTML = `
    <span data-terrain-chip="broken"><i aria-hidden="true"></i><b>Broken Ground</b><small>Higher movement cost</small></span>
    <span data-terrain-chip="raised"><i aria-hidden="true">▲</i><b>Raised Ground</b><small>Elevation +1</small></span>
  `
  battlefield.appendChild(legend)

  for (const tile of battlefield.querySelectorAll<HTMLButtonElement>('button[aria-label]')) {
    const label = tile.getAttribute('aria-label')
    if (label?.includes('rough ground')) {
      tile.setAttribute('aria-label', label.replace('rough ground', 'broken ground'))
    }
  }
}

function polishHeader() {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  const main = battlefield?.closest('main')
  const header = main?.querySelector('header')
  if (!header) return

  const strongs = Array.from(header.querySelectorAll<HTMLElement>('strong'))
  const objective = strongs.find((strong) => {
    const text = textOf(strong).toLowerCase()
    return text.includes('defeat') || text.includes('opposing') || text.includes('recruit')
  })
  if (objective) objective.textContent = 'Steel is drawn. The battle is underway.'
}

function applyPvpIdentityColors(metadata: PvpBattleMetadata | undefined) {
  if (!metadata) return
  const ordered = [...metadata.participants].sort(
    (a, b) => a.teamIndex - b.teamIndex || a.seatIndex - b.seatIndex || a.characterId.localeCompare(b.characterId),
  )
  const colors = new Map(
    ordered.map((participant, index) => [participant.characterName, COMBATANT_COLORS[index % COMBATANT_COLORS.length]]),
  )

  for (const tile of document.querySelectorAll<HTMLButtonElement>(
    '#battlefield button[aria-label*="occupied by"]',
  )) {
    const label = tile.getAttribute('aria-label') ?? ''
    const match = ordered.find((participant) => label.includes(`occupied by ${participant.characterName}`))
    if (!match) continue
    const color = colors.get(match.characterName)
    if (!color) continue
    tile.style.setProperty('--combatant-accent', color)
    const token = tile.querySelector<HTMLElement>(':scope > span:last-child')
    if (token) {
      token.style.borderColor = color
      token.style.boxShadow = `0 0 0 2px ${color}55, 0 0 1rem ${color}88`
    }
  }

  const pvpRoot = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
  if (!pvpRoot) return
  for (const article of pvpRoot.querySelectorAll<HTMLElement>('article')) {
    const participant = ordered.find((candidate) => textOf(article).includes(candidate.characterName))
    if (!participant) continue
    const color = colors.get(participant.characterName)
    if (!color) continue
    article.style.setProperty('--combatant-accent', color)
    const image = article.querySelector<HTMLElement>('img')
    if (image) {
      image.style.borderColor = color
      image.style.boxShadow = `0 0 .65rem ${color}88`
    }
  }
}

function polishPortraits() {
  for (const tile of document.querySelectorAll<HTMLButtonElement>(
    '#battlefield button[aria-label*="occupied by"]',
  )) {
    const token = tile.querySelector<HTMLElement>(':scope > span:last-child')
    if (!token) continue
    for (const image of token.querySelectorAll<HTMLImageElement>('img')) {
      image.style.display = 'block'
      image.style.width = '100%'
      image.style.height = '100%'
      image.style.maxWidth = 'none'
      image.style.maxHeight = 'none'
      image.style.objectFit = 'cover'
      image.style.objectPosition = '50% 50%'
      image.style.borderRadius = '50%'
    }
  }
}

export function BattlePresentationPolish({
  playerName,
  pvpMetadata,
}: {
  playerName: string
  pvpMetadata?: PvpBattleMetadata
}) {
  useEffect(() => {
    const run = () => {
      polishHeader()
      polishTerrainLegend()
      polishPortraits()
      applyFacingGuides(playerName)
      applyPvpIdentityColors(pvpMetadata)
    }

    run()
    const observer = new MutationObserver(run)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    const onDoubleClick = (event: MouseEvent) => {
      if (!isFinishMode()) return
      const tile = (event.target as Element | null)?.closest<HTMLButtonElement>(
        '#battlefield button[aria-label*="occupied by"]',
      )
      if (!tile || !tile.getAttribute('aria-label')?.includes(`occupied by ${playerName}`)) return
      event.preventDefault()
      event.stopPropagation()
      commitCurrentFacing(playerName)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      const finish = findFinishButton()
      if (!finish || finish.disabled) return
      event.preventDefault()
      if (isFinishMode()) commitCurrentFacing(playerName)
      else finish.click()
    }

    document.addEventListener('dblclick', onDoubleClick, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      observer.disconnect()
      clearFacingGuides()
      document.removeEventListener('dblclick', onDoubleClick, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [playerName, pvpMetadata])

  return null
}
