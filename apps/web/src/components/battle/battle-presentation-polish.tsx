'use client'

import { useEffect } from 'react'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'

const COMBATANT_COLORS = ['#67c98a', '#dc6a66', '#67aee8', '#d9ad5c', '#a984e8', '#df7eb5'] as const
const MOBILE_BATTLE_QUERY = '(max-width: 820px)'
const MOBILE_TOKEN_SHADOW = '0 0.35rem 0.9rem rgba(0, 0, 0, 0.5)'

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

function facingButtonsAvailable(): boolean {
  return Boolean(
    document.querySelector<HTMLButtonElement>('[aria-label="Face north"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face east"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face south"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face west"]:not(:disabled)'),
  )
}

function isFinishMode(root: ParentNode = document): boolean {
  const button = findFinishButton(root)
  return Boolean(
    facingButtonsAvailable() ||
    button?.hasAttribute('data-active') ||
    button?.getAttribute('aria-pressed') === 'true' ||
    `${button?.className ?? ''}`.includes('commandActive'),
  )
}

function findPlayerTile(playerName: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '#battlefield button[aria-label*="occupied by"]',
      ),
    ).find((tile) => tile.getAttribute('aria-label')?.includes(`occupied by ${playerName}`)) ?? null
  )
}

function commitCurrentFacing(playerName: string): boolean {
  const tile = findPlayerTile(playerName)
  if (!tile) return false
  const glyph = tile.querySelector<HTMLElement>('i')?.textContent ?? tile.textContent ?? ''
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
    tile.removeAttribute('data-facing-quick-selected')
    tile.removeAttribute('aria-pressed')
    tile.querySelector('[data-facing-arrow]')?.remove()
  }
}

function reconcileFacingGuides(playerName: string) {
  const current = Array.from(document.querySelectorAll<HTMLElement>('[data-facing-guide]'))
  if (!isFinishMode()) {
    if (current.length > 0) clearFacingGuides()
    return
  }

  const origin = findPlayerTile(playerName)
  const coordinates = origin ? tileCoordinates(origin) : null
  if (!origin || !coordinates) return

  const desired = [
    { x: coordinates.x, y: coordinates.y - 1, direction: 'north' },
    { x: coordinates.x + 1, y: coordinates.y, direction: 'east' },
    { x: coordinates.x, y: coordinates.y + 1, direction: 'south' },
    { x: coordinates.x - 1, y: coordinates.y, direction: 'west' },
  ] as const
  const desiredByCoordinate = new Map(desired.map((target) => [`${target.x}:${target.y}`, target]))
  const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>('#battlefield button'))

  for (const tile of current) {
    if (!(tile instanceof HTMLButtonElement)) continue
    const value = tileCoordinates(tile)
    const target = value ? desiredByCoordinate.get(`${value.x}:${value.y}`) : undefined
    if (!target || tile.dataset.facingDirection !== target.direction) {
      tile.removeAttribute('data-facing-guide')
      tile.removeAttribute('data-facing-direction')
      tile.removeAttribute('data-facing-quick-selected')
      tile.removeAttribute('aria-pressed')
    }
    tile.querySelector('[data-facing-arrow]')?.remove()
  }

  for (const target of desired) {
    const tile = tiles.find((candidate) => {
      const value = tileCoordinates(candidate)
      return value?.x === target.x && value.y === target.y
    })
    if (!tile) continue

    tile.dataset.facingGuide = 'true'
    tile.dataset.facingDirection = target.direction
    tile.querySelector('[data-facing-arrow]')?.remove()
  }
}

function createPolishedTerrainLegend(): HTMLDivElement {
  const legend = document.createElement('div')
  legend.dataset.terrainLegendPolish = 'true'
  legend.setAttribute('aria-label', 'Terrain legend')
  legend.innerHTML = `
    <span data-terrain-chip="broken"><i aria-hidden="true"></i><b>Difficult Ground</b><small>Higher movement cost</small></span>
    <span data-terrain-chip="raised"><i aria-hidden="true">▲</i><b>Raised Ground</b><small>Elevation +1</small></span>
  `
  return legend
}

function polishTerrainLegend() {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  if (!battlefield) return

  const isPvpBattle = Boolean(battlefield.closest('main[data-pvp-battle="true"]'))
  const polishedLegend = battlefield.querySelector<HTMLElement>('[data-terrain-legend-polish]')
  const nativeLegend = Array.from(battlefield.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.getAttribute('aria-label') === 'Terrain legend' &&
      !child.hasAttribute('data-terrain-legend-polish'),
  )

  if (!isPvpBattle) {
    polishedLegend?.remove()
  } else if (nativeLegend) {
    const replacement = polishedLegend ?? createPolishedTerrainLegend()
    nativeLegend.replaceWith(replacement)
  } else if (!polishedLegend) {
    battlefield.appendChild(createPolishedTerrainLegend())
  }

  for (const tile of battlefield.querySelectorAll<HTMLButtonElement>('button[aria-label]')) {
    const label = tile.getAttribute('aria-label')
    if (label?.includes('rough ground')) {
      tile.setAttribute('aria-label', label.replace('rough ground', 'difficult ground'))
    }
  }
}

function polishHeader() {
  const track = document.querySelector<HTMLElement>(
    '[role="progressbar"][aria-label="Action Economy remaining"]',
  )
  const header = track?.closest('header')
  if (!header) return

  const strongs = Array.from(header.querySelectorAll<HTMLElement>('strong'))
  const objective = strongs.find((strong) => {
    const text = textOf(strong).toLowerCase()
    return text.includes('defeat') || text.includes('opposing') || text.includes('recruit')
  })
  if (objective && objective.textContent !== 'Steel is drawn. The battle is underway.') {
    objective.textContent = 'Steel is drawn. The battle is underway.'
  }

  const economy = track?.parentElement?.parentElement
  if (economy instanceof HTMLElement && economy.dataset.battleEconomyPanel !== 'true') {
    economy.dataset.battleEconomyPanel = 'true'
  }
  const victory = Array.from(header.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    textOf(button).includes('Victory Conditions'),
  )
  if (victory && victory.dataset.battleVictoryButton !== 'true') {
    victory.dataset.battleVictoryButton = 'true'
  }
}

function applyPvpIdentityColors(metadata: PvpBattleMetadata | undefined) {
  if (!metadata) return
  const mobileBattlefield = window.matchMedia(MOBILE_BATTLE_QUERY).matches
  const ordered = [...metadata.participants].sort(
    (a, b) =>
      a.teamIndex - b.teamIndex ||
      a.seatIndex - b.seatIndex ||
      a.characterId.localeCompare(b.characterId),
  )
  const colors = new Map(
    ordered.map((participant, index) => [
      participant.characterName,
      COMBATANT_COLORS[index % COMBATANT_COLORS.length],
    ]),
  )

  for (const tile of document.querySelectorAll<HTMLButtonElement>(
    '#battlefield button[aria-label*="occupied by"]',
  )) {
    const label = tile.getAttribute('aria-label') ?? ''
    const match = ordered.find((participant) =>
      label.includes(`occupied by ${participant.characterName}`),
    )
    if (!match) continue
    const color = colors.get(match.characterName)
    if (!color) continue
    if (tile.style.getPropertyValue('--combatant-accent') !== color) {
      tile.style.setProperty('--combatant-accent', color)
    }
    const token = tile.querySelector<HTMLElement>(':scope > span:last-child')
    if (token) {
      if (token.style.borderColor !== color) token.style.borderColor = color
      const shadow = mobileBattlefield
        ? MOBILE_TOKEN_SHADOW
        : `0 0 0 2px ${color}55, 0 0 1rem ${color}88`
      if (token.style.boxShadow !== shadow) token.style.boxShadow = shadow
    }
  }

  const pvpRoot = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
  if (!pvpRoot) return
  for (const article of pvpRoot.querySelectorAll<HTMLElement>('article')) {
    const participant = ordered.find((candidate) =>
      textOf(article).includes(candidate.characterName),
    )
    if (!participant) continue
    const color = colors.get(participant.characterName)
    if (!color) continue
    if (article.style.getPropertyValue('--combatant-accent') !== color) {
      article.style.setProperty('--combatant-accent', color)
    }
    const image = article.querySelector<HTMLElement>('img')
    if (image) {
      if (image.style.borderColor !== color) image.style.borderColor = color
      const shadow = `0 0 .65rem ${color}88`
      if (image.style.boxShadow !== shadow) image.style.boxShadow = shadow
    }
  }
}

function polishPortraits() {
  const mobileBattlefield = window.matchMedia(MOBILE_BATTLE_QUERY).matches
  for (const tile of document.querySelectorAll<HTMLButtonElement>(
    '#battlefield button[aria-label*="occupied by"]',
  )) {
    const token = tile.querySelector<HTMLElement>(':scope > span:last-child')
    if (!token) continue
    if (mobileBattlefield && token.style.boxShadow !== MOBILE_TOKEN_SHADOW) {
      token.style.boxShadow = MOBILE_TOKEN_SHADOW
    }
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
    let frame: number | null = null

    const run = () => {
      frame = null
      polishHeader()
      polishTerrainLegend()
      polishPortraits()
      reconcileFacingGuides(playerName)
      applyPvpIdentityColors(pvpMetadata)
    }

    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(run)
    }

    run()
    const root =
      document.querySelector<HTMLElement>('main[data-pvp-battle="true"]') ?? document.body
    const observer = new MutationObserver(schedule)
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled'],
    })

    const media = window.matchMedia(MOBILE_BATTLE_QUERY)
    media.addEventListener('change', schedule)

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
      )
        return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      const finish = findFinishButton()
      if (!finish || finish.disabled) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (isFinishMode()) commitCurrentFacing(playerName)
      else finish.click()
    }

    document.addEventListener('dblclick', onDoubleClick, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', schedule)
      if (frame !== null) window.cancelAnimationFrame(frame)
      clearFacingGuides()
      document.removeEventListener('dblclick', onDoubleClick, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [playerName, pvpMetadata])

  return null
}
