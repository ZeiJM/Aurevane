'use client'

import { useEffect } from 'react'

import styles from './battle-command-cockpit-polish.module.css'

const COMMAND_SLUGS = new Map<string, string>([
  ['Inspect', 'inspect'],
  ['Move', 'move'],
  ['Basic Attack', 'attack'],
  ['Guard', 'guard'],
  ['Recover', 'recover'],
  ['Finish Turn', 'finish'],
  ['End Turn', 'finish'],
  ['Facing / End Turn', 'finish'],
])

function syncCommandDeck(deck: HTMLElement): void {
  deck.dataset.battleCockpitPolish = 'true'

  const commandButtons = Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).filter(
    (button) => COMMAND_SLUGS.has(button.querySelector(':scope > strong')?.textContent?.trim() ?? ''),
  )

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
      if (active) button.dataset.battleActive = 'true'
      else delete button.dataset.battleActive
    }
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

    sync()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-active', 'disabled'],
    })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <span className={styles.hook} aria-hidden="true" />
}
