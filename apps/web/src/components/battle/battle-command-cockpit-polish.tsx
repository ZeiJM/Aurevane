'use client'

import { useEffect } from 'react'

import contextStyles from './battle-command-context-guide.module.css'
import styles from './battle-command-cockpit-polish.module.css'

type CommandSlug = 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'
type MobileTokenContext = 'ai' | 'pvp'

interface MeterPair {
  hp: string
  mp: string
}

const COMMAND_SLUGS = new Map<string, CommandSlug>([
  ['Inspect', 'inspect'],
  ['Move', 'move'],
  ['Basic Attack', 'attack'],
  ['Guard', 'guard'],
  ['Recover', 'recover'],
  ['Finish Turn', 'finish'],
  ['End Turn', 'finish'],
  ['Facing / End Turn', 'finish'],
])

function directTitle(row: HTMLElement): HTMLElement | null {
  return row.querySelector<HTMLElement>(':scope > strong')
}

function directDescription(row: HTMLElement): HTMLElement | null {
  return (
    Array.from(row.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLSpanElement &&
        !child.hasAttribute('data-pvp-turn-clock-slot') &&
        !child.hasAttribute('data-pvp-turn-clock') &&
        !child.hasAttribute('data-pvp-opponent-turn-clock') &&
        !child.hasAttribute('data-pvp-command-context'),
    ) ?? null
  )
}

function markInstructionElements(deck: HTMLElement): HTMLElement | null {
  const host = deck.firstElementChild
  if (!(host instanceof HTMLElement)) return null

  const nested = host.firstElementChild
  const row = directTitle(host)
    ? host
    : nested instanceof HTMLElement && directTitle(nested)
      ? nested
      : null
  if (!row) return null

  host.dataset.battleInstructionHost = 'true'
  row.dataset.battleInstructionRow = 'true'
  const title = directTitle(row)
  const description = directDescription(row)
  if (title) title.dataset.battleInstructionTitle = 'true'
  if (description) description.dataset.battleInstructionDescription = 'true'
  return row
}

function directUnit(tile: HTMLElement): HTMLElement | null {
  return (
    Array.from(tile.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && Boolean(child.querySelector(':scope > strong')),
    ) ?? null
  )
}

function meterWidth(fill: Element | null): string | null {
  if (!(fill instanceof HTMLElement)) return null
  return fill.style.width || null
}

function aiMeters(name: string): MeterPair | null {
  const details = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[aria-label$=" combat details"]'),
  ).find((button) => button.getAttribute('aria-label') === `Show ${name} combat details`)
  if (!details) return null

  const hp = meterWidth(details.querySelector('span[aria-label*=" HP "] > i'))
  const mp = meterWidth(details.querySelector('span[aria-label*=" MP "] > i'))
  return hp && mp ? { hp, mp } : null
}

function pvpMeterMap(): Map<string, MeterPair> {
  const result = new Map<string, MeterPair>()
  const roster = document.querySelector<HTMLElement>('section[aria-label="PvP battle roster"]')
  if (!roster) return result

  Array.from(roster.children).forEach((teamElement, teamIndex) => {
    for (const article of teamElement.querySelectorAll<HTMLElement>('article')) {
      const name = article.querySelector<HTMLElement>('strong')?.textContent?.trim()
      if (!name) continue
      const fills = Array.from(article.querySelectorAll<HTMLElement>('span > i')).filter(
        (fill) => Boolean(fill.style.width),
      )
      const hp = meterWidth(fills[0] ?? null)
      const mp = meterWidth(fills[1] ?? null)
      if (hp && mp) result.set(`${teamIndex}:${name}`, { hp, mp })
    }
  })

  return result
}

function syncTokenMeter(unit: HTMLElement, meters: MeterPair, context: MobileTokenContext): void {
  let host = unit.querySelector<HTMLElement>(':scope > [data-mobile-token-meters="true"]')
  if (!host) {
    host = document.createElement('span')
    host.dataset.mobileTokenMeters = 'true'
    host.setAttribute('aria-hidden', 'true')

    for (const resource of ['hp', 'mp'] as const) {
      const track = document.createElement('span')
      track.dataset.mobileTokenMeter = resource
      track.append(document.createElement('i'))
      host.append(track)
    }
    unit.append(host)
  }

  host.dataset.mobileTokenContext = context
  const hpFill = host.querySelector<HTMLElement>('[data-mobile-token-meter="hp"] > i')
  const mpFill = host.querySelector<HTMLElement>('[data-mobile-token-meter="mp"] > i')
  if (hpFill && hpFill.style.width !== meters.hp) hpFill.style.width = meters.hp
  if (mpFill && mpFill.style.width !== meters.mp) mpFill.style.width = meters.mp
}

function syncAiTokenMeters(): void {
  const battlefield = document.querySelector<HTMLElement>('section[aria-label="Tactical battlefield"]')
  if (!battlefield) return

  for (const tile of battlefield.querySelectorAll<HTMLElement>('button[aria-label*="occupied by"]')) {
    const unit = directUnit(tile)
    const name = unit?.querySelector<HTMLElement>(':scope > strong')?.textContent?.trim()
    if (!unit || !name) continue
    const meters = aiMeters(name)
    if (meters) syncTokenMeter(unit, meters, 'ai')
  }
}

function syncPvpTokenMeters(): void {
  const battlefield = document.querySelector<HTMLElement>(
    'section[aria-label="PvP tactical battlefield"]',
  )
  if (!battlefield) return

  const metersByUnit = pvpMeterMap()
  for (const tile of battlefield.querySelectorAll<HTMLElement>('button[aria-label*="occupied by"]')) {
    const unit = directUnit(tile)
    const name = unit?.querySelector<HTMLElement>(':scope > strong')?.textContent?.trim()
    const team = unit?.dataset.team
    if (!unit || !name || team === undefined) continue
    const meters = metersByUnit.get(`${team}:${name}`)
    if (meters) syncTokenMeter(unit, meters, 'pvp')
  }
}

function syncCommandDeck(deck: HTMLElement): void {
  deck.dataset.battleCockpitPolish = 'true'

  const commandButtons = Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).filter(
    (button) =>
      COMMAND_SLUGS.has(button.querySelector(':scope > strong')?.textContent?.trim() ?? ''),
  )
  let activeSlug: CommandSlug | null = null

  if (commandButtons.length > 0) {
    const commandGroup = commandButtons[0]?.parentElement
    if (commandGroup instanceof HTMLElement) commandGroup.dataset.battleCommandGroup = 'true'

    for (const button of commandButtons) {
      const label = button.querySelector(':scope > strong')?.textContent?.trim() ?? ''
      const slug = COMMAND_SLUGS.get(label)
      if (!slug) continue
      button.dataset.battleCommand = slug

      const active =
        button.hasAttribute('data-active') || `${button.className}`.includes('commandActive')
      if (active) {
        button.dataset.battleActive = 'true'
        activeSlug = slug
      } else {
        delete button.dataset.battleActive
      }
    }
  }

  const instruction = markInstructionElements(deck)
  if (instruction) {
    if (activeSlug) instruction.dataset.battleCommandExplanation = activeSlug
    else delete instruction.dataset.battleCommandExplanation
  }

  const facingButtons = Array.from(
    deck.querySelectorAll<HTMLButtonElement>('button[aria-label^="Face "]'),
  )
  const facingControl = facingButtons[0]?.parentElement
  if (facingControl instanceof HTMLElement) {
    facingControl.dataset.battleFacingControl = 'true'
    if (facingButtons.some((button) => !button.disabled)) {
      facingControl.dataset.battleFacingEnabled = 'true'
    } else {
      delete facingControl.dataset.battleFacingEnabled
    }
  }
}

export function BattleCommandCockpitPolish() {
  useEffect(() => {
    const initialDeck = document.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
    const battleRoot = initialDeck?.closest<HTMLElement>('main') ?? null
    if (!initialDeck || !battleRoot) return

    let frame = 0
    const decks = () => battleRoot.querySelectorAll<HTMLElement>('section[aria-label="Command Deck"]')

    const sync = () => {
      frame = 0
      syncAiTokenMeters()
      syncPvpTokenMeters()
      for (const deck of decks()) syncCommandDeck(deck)
    }

    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    const observer = new MutationObserver(schedule)
    observer.observe(battleRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-active', 'disabled', 'aria-label'],
    })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <span className={`${styles.hook} ${contextStyles.hook}`} aria-hidden="true" />
}
