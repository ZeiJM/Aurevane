'use client'

import { useEffect } from 'react'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'

import { pvpParticipantAccent } from './battle-combatant-colors'

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

function polishHeader() {
  const track = document.querySelector<HTMLElement>(
    '[role="progressbar"][aria-label="Action Economy remaining"]',
  )
  const header = track?.closest('header')
  if (!track || !header) return

  const strongs = Array.from(header.querySelectorAll<HTMLElement>('strong'))
  const objective = strongs.find((strong) => {
    const text = textOf(strong).toLowerCase()
    return text.includes('defeat') || text.includes('opposing') || text.includes('recruit')
  })
  if (objective && objective.textContent !== 'Steel is drawn. The battle is underway.') {
    objective.textContent = 'Steel is drawn. The battle is underway.'
  }

  const economy = track.parentElement
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
  const ordered = [...metadata.participants].sort(
    (a, b) =>
      a.teamIndex - b.teamIndex ||
      a.seatIndex - b.seatIndex ||
      a.characterId.localeCompare(b.characterId),
  )
  const teamCount = Math.max(1, new Set(ordered.map((participant) => participant.teamIndex)).size)
  const colors = new Map(
    ordered.map((participant) => [
      participant.characterName,
      pvpParticipantAccent(participant.teamIndex, participant.seatIndex, teamCount),
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
    let frame: number | null = null

    const run = () => {
      frame = null
      polishHeader()
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
      if (frame !== null) window.cancelAnimationFrame(frame)
      clearFacingGuides()
      document.removeEventListener('dblclick', onDoubleClick, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [playerName, pvpMetadata])

  return null
}
