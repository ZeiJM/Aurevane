'use client'

import { useEffect } from 'react'

import type { BattlePreviewView } from '@/server/battle/battle-preview-service'

import contextStyles from './battle-command-context-guide.module.css'
import styles from './battle-command-cockpit-polish.module.css'

type CommandSlug = 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'
type IntentPreview = BattlePreviewView['preview']
type ActionPreview = Extract<IntentPreview, { kind: 'action' }>

type PreviewTone = 'chance' | 'damage' | 'heal' | 'effect' | 'cost' | 'blocked'
type MobileTokenContext = 'ai' | 'pvp'

interface PreviewChip {
  label: string
  tone: PreviewTone
}

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

const COMMAND_PRESENTATION: Record<CommandSlug, { title: string; description: string }> = {
  inspect: {
    title: 'Inspect',
    description: 'Review terrain and unit details. No AP is spent.',
  },
  move: {
    title: 'Move',
    description: 'Choose a reachable tile. Terrain sets the AP cost.',
  },
  attack: {
    title: 'Basic Attack',
    description: 'Select an adjacent enemy. Costs 30 AP.',
  },
  guard: {
    title: 'Guard',
    description: 'Reduce incoming damage for 2 turns. Costs 30 AP.',
  },
  recover: {
    title: 'Recover',
    description: 'Restore 10% of max HP. Costs 50 AP.',
  },
  finish: {
    title: 'Finish Turn',
    description: 'Choose your final facing to end the turn.',
  },
}

interface InstructionElements {
  host: HTMLElement
  row: HTMLElement
  title: HTMLElement
  description: HTMLElement | null
}

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
        !child.hasAttribute('data-pvp-opponent-turn-clock'),
    ) ?? null
  )
}

function markInstructionElements(deck: HTMLElement): InstructionElements | null {
  const host = deck.firstElementChild
  if (!(host instanceof HTMLElement)) return null

  const nested = host.firstElementChild
  const row = directTitle(host)
    ? host
    : nested instanceof HTMLElement && directTitle(nested)
      ? nested
      : null
  if (!row) return null

  const title = directTitle(row)
  if (!title) return null
  const description = directDescription(row)

  host.dataset.battleInstructionHost = 'true'
  row.dataset.battleInstructionRow = 'true'
  title.dataset.battleInstructionTitle = 'true'
  if (description) description.dataset.battleInstructionDescription = 'true'

  return { host, row, title, description }
}

function clearCommandPreview(deck: HTMLElement): void {
  for (const preview of deck.querySelectorAll<HTMLElement>(
    '[data-battle-target-preview="true"][data-battle-preview-key]',
  )) {
    preview.remove()
  }
}

function isPvpDeck(deck: HTMLElement): boolean {
  return deck.closest<HTMLElement>('main')?.dataset.pvpBattle === 'true'
}

function semanticDescription(deck: HTMLElement, slug: CommandSlug): string {
  if (!isPvpDeck(deck) && slug === 'move') {
    return 'Move · 25 AP per normal tile. Green tiles are reachable. Rough ground costs 50 AP. Click a destination to draw the numbered path.'
  }
  return COMMAND_PRESENTATION[slug].description
}

function showCommandDescription(
  deck: HTMLElement,
  slug: CommandSlug,
  options: { clearPreview?: boolean } = {},
): void {
  const instruction = markInstructionElements(deck)
  if (!instruction?.description) return

  if (options.clearPreview !== false) clearCommandPreview(deck)
  const presentation = COMMAND_PRESENTATION[slug]
  const description = semanticDescription(deck, slug)
  instruction.row.dataset.battleCommandExplanation = slug
  if (instruction.title.textContent !== presentation.title) {
    instruction.title.textContent = presentation.title
  }
  if (instruction.description.textContent !== description) {
    instruction.description.textContent = description
  }
  if (instruction.description.style.display) instruction.description.style.display = ''
  if (instruction.description.title !== presentation.description) {
    instruction.description.title = presentation.description
  }
}

function humanizeStatus(value: string): string {
  const id = value.split(':')[0] ?? value
  return id
    .replace(/^status\./, '')
    .replaceAll('.', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function numericEffectDelta(
  effect: ActionPreview['projectedEffects'][number],
): number | null {
  if (typeof effect.before !== 'number' || typeof effect.after !== 'number') return null
  return effect.after - effect.before
}

function previewSlug(preview: IntentPreview): CommandSlug | null {
  if (preview.kind === 'move') return 'move'
  if (preview.kind === 'face' || preview.kind === 'end-turn') return 'finish'
  if (preview.kind !== 'action') return null
  if (preview.actionId === 'basic.attack.unarmed.basic') return 'attack'
  if (preview.actionId === 'basic.guard') return 'guard'
  if (preview.actionId === 'basic.recover') return 'recover'
  return null
}

function actionPreviewChips(preview: ActionPreview): PreviewChip[] {
  if (!preview.legal) {
    return [{ label: 'Blocked', tone: 'blocked' }]
  }

  const chips: PreviewChip[] = []
  chips.push({
    label:
      preview.hitChanceBasisPoints === null
        ? 'Success 100%'
        : `Hit ${Math.round(preview.hitChanceBasisPoints / 100)}%`,
    tone: 'chance',
  })

  if (preview.mitigatedBaseDamage !== null) {
    chips.push({ label: `On hit ${preview.mitigatedBaseDamage} dmg`, tone: 'damage' })
  } else {
    const projectedDamage = preview.projectedEffects
      .filter((effect) => effect.effectType === 'damage')
      .reduce((total, effect) => {
        const delta = numericEffectDelta(effect)
        return total + (delta === null ? 0 : Math.max(0, -delta))
      }, 0)
    if (projectedDamage > 0) {
      chips.push({ label: `${projectedDamage} dmg`, tone: 'damage' })
    }
  }

  const projectedHealing = preview.projectedEffects
    .filter((effect) => effect.effectType === 'healing')
    .reduce((total, effect) => {
      const delta = numericEffectDelta(effect)
      return total + (delta === null ? 0 : Math.max(0, delta))
    }, 0)
  if (projectedHealing > 0) {
    chips.push({ label: `Heal +${projectedHealing}`, tone: 'heal' })
  }

  const resourceDelta = preview.projectedEffects
    .filter((effect) => effect.effectType === 'resource-change')
    .reduce((total, effect) => total + (numericEffectDelta(effect) ?? 0), 0)
  if (resourceDelta !== 0) {
    chips.push({
      label: `Resource ${resourceDelta > 0 ? '+' : ''}${resourceDelta}`,
      tone: resourceDelta > 0 ? 'heal' : 'cost',
    })
  }

  for (const status of preview.projectedStatuses) {
    chips.push({ label: humanizeStatus(status.statusId), tone: 'effect' })
    if (
      status.damageTakenMultiplierBasisPoints !== null &&
      status.damageTakenMultiplierBasisPoints < 10_000
    ) {
      const reduction = Math.round((10_000 - status.damageTakenMultiplierBasisPoints) / 100)
      chips.push({ label: `-${reduction}% damage`, tone: 'effect' })
    }
    if (status.durationOwnerTurnStarts !== null) {
      chips.push({
        label: `${status.durationOwnerTurnStarts} turn${status.durationOwnerTurnStarts === 1 ? '' : 's'}`,
        tone: 'effect',
      })
    }
  }

  if (preview.projectedStatuses.length === 0) {
    const statuses = new Set(
      preview.projectedEffects
        .filter((effect) => effect.effectType === 'apply-status' && typeof effect.after === 'string')
        .map((effect) => humanizeStatus(String(effect.after))),
    )
    for (const status of statuses) {
      chips.push({ label: status, tone: 'effect' })
    }
  }

  if (preview.affectedCombatantIds.length > 1) {
    chips.push({ label: `${preview.affectedCombatantIds.length} targets`, tone: 'effect' })
  }

  return chips
}

function previewChips(preview: IntentPreview): PreviewChip[] {
  if (!preview.legal) return [{ label: 'Blocked', tone: 'blocked' }]

  if (preview.kind === 'move') {
    return [
      { label: `${preview.actionEconomyCost} AP`, tone: 'cost' },
      { label: `${preview.actionEconomyAfter} AP left`, tone: 'effect' },
      {
        label: `${Math.max(0, preview.path.length - 1)} tile${preview.path.length === 2 ? '' : 's'}`,
        tone: 'effect',
      },
    ]
  }

  if (preview.kind === 'action') return actionPreviewChips(preview)

  if (preview.kind === 'face') {
    return [
      { label: 'Success 100%', tone: 'chance' },
      { label: `Face ${humanizeStatus(preview.facing)}`, tone: 'effect' },
      { label: 'Ends turn', tone: 'cost' },
    ]
  }

  return [{ label: 'Choose facing', tone: 'effect' }]
}

function showBattlePreview(deck: HTMLElement, preview: IntentPreview): void {
  const slug = previewSlug(preview)
  if (!slug || slug === 'inspect') return

  showCommandDescription(deck, slug, { clearPreview: false })
  const instruction = markInstructionElements(deck)
  if (!instruction) return

  const chips = previewChips(preview)
  const previewKey = JSON.stringify({ slug, chips })
  const existing = deck.querySelector<HTMLElement>(
    '[data-battle-target-preview="true"][data-battle-preview-key]',
  )
  if (existing?.dataset.battlePreviewKey === previewKey) return
  existing?.remove()

  const previewElement = document.createElement('div')
  previewElement.dataset.battleTargetPreview = 'true'
  previewElement.dataset.battlePreviewCommand = slug
  previewElement.dataset.battlePreviewKey = previewKey
  previewElement.setAttribute('aria-label', 'Action preview')

  if (!preview.legal && preview.issues[0]?.message) {
    previewElement.title = preview.issues[0].message
  } else if (preview.kind === 'action' && preview.hitChanceBasisPoints !== null) {
    previewElement.title =
      'Damage is shown for a successful hit; the final result is resolved by the server.'
  } else {
    previewElement.title = 'Authoritative pre-commit action preview.'
  }

  for (const chip of chips) {
    const element = document.createElement('span')
    element.dataset.battlePreviewChip = 'true'
    element.dataset.battlePreviewTone = chip.tone
    element.textContent = chip.label
    previewElement.append(element)
  }

  instruction.row.append(previewElement)
}

function isBattlePreviewRequest(input: RequestInfo | URL): boolean {
  try {
    const raw = input instanceof Request ? input.url : input instanceof URL ? input.href : input
    const path = new URL(raw, window.location.origin).pathname
    return /^\/api\/battles\/[^/]+\/preview\/?$/.test(path)
  } catch {
    return false
  }
}

function readBattlePreview(body: unknown): BattlePreviewView | null {
  if (!body || typeof body !== 'object') return null
  const candidate = (body as { battlePreview?: unknown }).battlePreview
  if (!candidate || typeof candidate !== 'object') return null
  const preview = (candidate as { preview?: unknown }).preview
  if (!preview || typeof preview !== 'object') return null
  return candidate as BattlePreviewView
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

function syncTokenMeter(
  unit: HTMLElement,
  meters: MeterPair,
  context: MobileTokenContext,
): void {
  let host = unit.querySelector<HTMLElement>(':scope > [data-mobile-token-meters="true"]')
  if (!host) {
    host = document.createElement('span')
    host.dataset.mobileTokenMeters = 'true'
    host.dataset.mobileTokenContext = context
    host.setAttribute('aria-hidden', 'true')

    for (const resource of ['hp', 'mp'] as const) {
      const track = document.createElement('span')
      track.dataset.mobileTokenMeter = resource
      const fill = document.createElement('i')
      track.append(fill)
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

function syncBattlefieldTokenMeters(): void {
  syncAiTokenMeters()
  syncPvpTokenMeters()
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
  if (
    instruction?.row.dataset.battleCommandExplanation &&
    instruction.row.dataset.battleCommandExplanation !== activeSlug
  ) {
    delete instruction.row.dataset.battleCommandExplanation
  }

  const visiblePreview = deck.querySelector<HTMLElement>(
    '[data-battle-target-preview="true"][data-battle-preview-key]',
  )
  if (visiblePreview && visiblePreview.dataset.battlePreviewCommand !== activeSlug) {
    visiblePreview.remove()
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
    const previousFetch = window.fetch

    const decks = () => battleRoot.querySelectorAll<HTMLElement>('section[aria-label="Command Deck"]')

    const sync = () => {
      frame = 0
      syncBattlefieldTokenMeters()
      for (const deck of decks()) syncCommandDeck(deck)
    }

    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(sync)
    }

    const handleClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null
      const button = element?.closest<HTMLButtonElement>(
        'section[aria-label="Command Deck"] button',
      )
      if (!button || button.disabled || !battleRoot.contains(button)) return

      const label = button.querySelector(':scope > strong')?.textContent?.trim() ?? ''
      const slug = COMMAND_SLUGS.get(label)
      const deck = button.closest<HTMLElement>('section[aria-label="Command Deck"]')
      if (!slug || !deck) return

      // Let the native battle handler enter its real mode first, then update presentation only.
      // The AI description remains visually hidden by the shared context CSS.
      window.requestAnimationFrame(() => showCommandDescription(deck, slug))
    }

    const observedFetch: typeof window.fetch = (...args) => {
      const observesPreview = isBattlePreviewRequest(args[0])
      if (observesPreview) {
        for (const deck of decks()) clearCommandPreview(deck)
      }

      // Return the exact Promise produced by the existing fetch implementation. The observer only
      // reads a cloned preview response and never changes request timing, response bodies, or errors.
      const responsePromise = previousFetch(...args)
      if (observesPreview) {
        void responsePromise
          .then((response) => {
            if (!response.ok) return
            void response
              .clone()
              .json()
              .then((body: unknown) => {
                const battlePreview = readBattlePreview(body)
                if (!battlePreview) return
                // React applies the native preview state first. Two animation frames keep this
                // presentation-only augmentation behind that render without intercepting input.
                window.requestAnimationFrame(() =>
                  window.requestAnimationFrame(() => {
                    for (const deck of decks()) showBattlePreview(deck, battlePreview.preview)
                  }),
                )
              })
              .catch(() => undefined)
          })
          .catch(() => undefined)
      }
      return responsePromise
    }

    sync()
    window.fetch = observedFetch
    const observer = new MutationObserver(schedule)
    observer.observe(battleRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-active', 'disabled', 'aria-label'],
    })
    document.addEventListener('click', handleClick)

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick)
      if (window.fetch === observedFetch) window.fetch = previousFetch
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <span className={`${styles.hook} ${contextStyles.hook}`} aria-hidden="true" />
}
