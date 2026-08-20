'use client'

import { useEffect } from 'react'

import styles from './battle-presentation-assist.module.css'

type GridPosition = { x: number; y: number }
type Facing = 'north' | 'east' | 'south' | 'west'

const BATTLE_LINE = 'Steel meets resolve. The battle is joined.'

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function battleHeader(): HTMLElement | null {
  const track = document.querySelector<HTMLElement>(
    '[role="progressbar"][aria-label="Action Economy remaining"]',
  )
  return track?.closest<HTMLElement>('header') ?? null
}

function commandButton(...labels: string[]): HTMLButtonElement | null {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
  )
  return (
    buttons.find((button) =>
      labels.includes(button.querySelector('strong')?.textContent?.trim() ?? ''),
    ) ?? null
  )
}

function facingModeIsActive(): boolean {
  return Boolean(
    document.querySelector<HTMLButtonElement>('[aria-label="Face north"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face east"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face south"]:not(:disabled)') &&
    document.querySelector<HTMLButtonElement>('[aria-label="Face west"]:not(:disabled)'),
  )
}

function battleTiles(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]'),
  )
}

function tilePosition(tile: HTMLButtonElement): GridPosition | null {
  const match = tile.getAttribute('aria-label')?.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return null
  return { x: Number(match[1]) - 1, y: Number(match[2]) - 1 }
}

function playerTile(playerName: string): HTMLButtonElement | null {
  return (
    battleTiles().find((tile) =>
      (tile.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
    ) ?? null
  )
}

function facingFromGlyph(text: string): Facing | null {
  if (text.includes('↑')) return 'north'
  if (text.includes('→')) return 'east'
  if (text.includes('↓')) return 'south'
  if (text.includes('←')) return 'west'
  return null
}

function currentFacing(playerName: string): Facing | null {
  const tile = playerTile(playerName)
  const fromTile = tile ? facingFromGlyph(tile.textContent ?? '') : null
  if (fromTile) return fromTile

  const rail = Array.from(
    document.querySelectorAll<HTMLElement>('aside[aria-label$=" combat status"]'),
  ).find((candidate) => candidate.getAttribute('aria-label') === `${playerName} combat status`)
  return rail ? facingFromGlyph(rail.textContent ?? '') : null
}

function commitCurrentFacing(playerName: string): boolean {
  const facing = currentFacing(playerName)
  if (!facing) return false
  const button = document.querySelector<HTMLButtonElement>(`[aria-label="Face ${facing}"]`)
  if (!button || button.disabled) return false
  button.click()
  return true
}

function syncHeader() {
  const header = battleHeader()
  const objective = header?.firstElementChild
  const heading = objective?.querySelector<HTMLElement>(':scope > strong')
  if (heading && heading.textContent !== BATTLE_LINE) heading.textContent = BATTLE_LINE
}

function buildLegendCopy(entry: HTMLElement, icon: string, title: string, detail: string) {
  const mark = document.createElement('b')
  mark.textContent = icon
  const copy = document.createElement('span')
  const strong = document.createElement('strong')
  strong.textContent = title
  const small = document.createElement('small')
  small.textContent = detail
  copy.append(strong, small)
  entry.replaceChildren(mark, copy)
}

function syncLegend() {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  const legend = battlefield?.lastElementChild
  if (!(legend instanceof HTMLElement)) return

  for (const entry of Array.from(legend.querySelectorAll<HTMLElement>(':scope > span'))) {
    const text = entry.textContent?.toLowerCase() ?? ''
    if ((text.includes('rough') || text.includes('r50')) && !entry.dataset.terrainLegend) {
      entry.dataset.terrainLegend = 'difficult'
      buildLegendCopy(entry, '▧', 'Difficult Ground', '2× movement cost')
    } else if (text.includes('elevation') && !entry.dataset.terrainLegend) {
      entry.dataset.terrainLegend = 'elevation'
      buildLegendCopy(entry, '▲', 'Elevation', 'height affects movement & attacks')
    }
  }
}

function clearFacingGuides() {
  for (const tile of battleTiles()) {
    delete tile.dataset.facingGuide
    tile.querySelector<HTMLElement>('[data-facing-arrow]')?.remove()
  }
}

function syncFacingGuides(playerName: string) {
  if (!facingModeIsActive()) {
    clearFacingGuides()
    return
  }

  const actor = playerTile(playerName)
  const origin = actor ? tilePosition(actor) : null
  if (!origin) return

  const guides: readonly [Facing, GridPosition, string][] = [
    ['north', { x: origin.x, y: origin.y - 1 }, '↑'],
    ['east', { x: origin.x + 1, y: origin.y }, '→'],
    ['south', { x: origin.x, y: origin.y + 1 }, '↓'],
    ['west', { x: origin.x - 1, y: origin.y }, '←'],
  ]
  const byPosition = new Map<string, HTMLButtonElement>()
  for (const tile of battleTiles()) {
    const position = tilePosition(tile)
    if (position) byPosition.set(`${position.x}:${position.y}`, tile)
  }

  for (const tile of battleTiles()) {
    delete tile.dataset.facingGuide
    tile.querySelector<HTMLElement>('[data-facing-arrow]')?.remove()
  }

  for (const [facing, position, glyph] of guides) {
    const tile = byPosition.get(`${position.x}:${position.y}`)
    if (!tile) continue
    tile.dataset.facingGuide = facing
    const arrow = document.createElement('span')
    arrow.dataset.facingArrow = 'true'
    arrow.textContent = glyph
    arrow.setAttribute('aria-hidden', 'true')
    tile.append(arrow)
  }
}

function syncTokenImages() {
  for (const image of Array.from(
    document.querySelectorAll<HTMLImageElement>(
      '#battlefield button[aria-label*="occupied by"] img',
    ),
  )) {
    image.dataset.battleTokenImage = 'true'
  }
}

export function BattlePresentationAssist({ playerName }: { playerName: string }) {
  useEffect(() => {
    let frame = 0
    const sync = () => {
      frame = 0
      syncHeader()
      syncLegend()
      syncFacingGuides(playerName)
      syncTokenImages()
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    function interceptFinishAgain(event: MouseEvent) {
      if (!facingModeIsActive()) return
      const target = event.target instanceof Element ? event.target : null
      const button = target?.closest<HTMLButtonElement>('button')
      if (!button) return
      const label = button.querySelector('strong')?.textContent?.trim()
      if (!['Finish Turn', 'End Turn', 'Facing / End Turn'].includes(label ?? '')) return
      event.preventDefault()
      event.stopImmediatePropagation()
      commitCurrentFacing(playerName)
    }

    function doubleClickSelf(event: MouseEvent) {
      if (!facingModeIsActive()) return
      const target = event.target instanceof Element ? event.target : null
      const tile = target?.closest<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]')
      if (!tile || tile !== playerTile(playerName)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      commitCurrentFacing(playerName)
    }

    function spaceToFinish(event: KeyboardEvent) {
      if (event.code !== 'Space' || isTextEntryTarget(event.target)) return
      const finish = commandButton('Finish Turn', 'End Turn', 'Facing / End Turn')
      if (!finish || finish.disabled) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (facingModeIsActive()) commitCurrentFacing(playerName)
      else finish.click()
    }

    document.addEventListener('click', interceptFinishAgain, true)
    document.addEventListener('dblclick', doubleClickSelf, true)
    window.addEventListener('keydown', spaceToFinish, true)
    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      clearFacingGuides()
      document.removeEventListener('click', interceptFinishAgain, true)
      document.removeEventListener('dblclick', doubleClickSelf, true)
      window.removeEventListener('keydown', spaceToFinish, true)
    }
  }, [playerName])

  return <span className={styles.scope} aria-hidden="true" />
}
