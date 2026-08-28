'use client'

import { useEffect } from 'react'

import contextStyles from './battle-command-context-guide.module.css'
import styles from './battle-command-cockpit-polish.module.css'

type CommandSlug = 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'

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

function showCommandDescription(deck: HTMLElement, slug: CommandSlug): void {
  const instruction = markInstructionElements(deck)
  if (!instruction?.description) return

  const presentation = COMMAND_PRESENTATION[slug]
  instruction.row.dataset.battleCommandExplanation = slug
  instruction.title.textContent = presentation.title
  instruction.description.textContent = presentation.description
  instruction.description.style.display = ''
  instruction.description.title = presentation.description
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
    let frame = 0

    const sync = () => {
      frame = 0
      for (const deck of document.querySelectorAll<HTMLElement>(
        'section[aria-label="Command Deck"]',
      )) {
        syncCommandDeck(deck)
      }
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
      if (!button || button.disabled) return

      const label = button.querySelector(':scope > strong')?.textContent?.trim() ?? ''
      const slug = COMMAND_SLUGS.get(label)
      const deck = button.closest<HTMLElement>('section[aria-label="Command Deck"]')
      if (!slug || !deck) return

      // Let the native battle handler enter its real mode first, then replace only the instructional
      // copy. This does not intercept the command, alter combat state, or touch battlefield sizing.
      window.requestAnimationFrame(() => showCommandDescription(deck, slug))
    }

    sync()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-active', 'disabled'],
    })
    document.addEventListener('click', handleClick)

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <span className={`${styles.hook} ${contextStyles.hook}`} aria-hidden="true" />
}
