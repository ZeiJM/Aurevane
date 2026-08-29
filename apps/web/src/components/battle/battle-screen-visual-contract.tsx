'use client'

import { useEffect } from 'react'

import styles from './battle-screen-visual-contract.module.css'

const COMMAND_LABELS = [
  'Inspect',
  'Move',
  'Basic Attack',
  'Guard',
  'Recover',
  'Finish Turn',
] as const

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? ''
}

function tag(element: Element | null, key: string, value = 'true') {
  if (!(element instanceof HTMLElement)) return
  if (element.dataset[key] !== value) element.dataset[key] = value
}

function clearTag(element: Element, key: string) {
  if (!(element instanceof HTMLElement)) return
  if (element.dataset[key] !== undefined) delete element.dataset[key]
}

function findBattleRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#battlefield')?.closest<HTMLElement>('main') ?? null
}

function tagHeader(root: HTMLElement) {
  const progress = root.querySelector<HTMLElement>(
    '[role="progressbar"][aria-label="Action Economy remaining"]',
  )
  const header = progress?.closest('header')
  if (!header) return

  tag(header, 'battleVisual', 'header')
  tag(header.firstElementChild, 'battleVisual', 'objective')

  const economy = progress?.parentElement?.parentElement
  tag(economy, 'battleVisual', 'economy')

  for (const button of header.querySelectorAll<HTMLButtonElement>('button')) {
    const copy = textOf(button)
    if (copy.includes('Victory Conditions')) tag(button, 'battleVisual', 'victory')
    if (copy.includes('Combat Log') || /^Round\s+\d+/i.test(copy)) {
      tag(button, 'battleVisual', 'roundLog')
    }
  }
}

function tagBattlefield(root: HTMLElement) {
  const battlefield = root.querySelector<HTMLElement>('#battlefield')
  if (!battlefield) return

  tag(battlefield, 'battleVisual', 'battlefield')

  const firstTile = battlefield.querySelector<HTMLButtonElement>('button[aria-label^="Tile "]')
  const board = firstTile?.parentElement
  if (board instanceof HTMLElement) {
    tag(board, 'battleVisual', 'board')
    if (board.parentElement && board.parentElement !== battlefield) {
      tag(board.parentElement, 'battleVisual', 'boardViewport')
    }
  }

  for (const tile of battlefield.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]')) {
    tag(tile, 'battleVisual', 'tile')
  }
}

function tagCommands(root: HTMLElement) {
  const commandDeck = root.querySelector<HTMLElement>('[aria-label="Command Deck"]')
  if (!commandDeck) return
  tag(commandDeck, 'battleVisual', 'commandDeck')

  const commandButtons = Array.from(commandDeck.querySelectorAll<HTMLButtonElement>('button')).filter(
    (button) => COMMAND_LABELS.some((label) => textOf(button).includes(label)),
  )
  const commandContainer = commandButtons[0]?.parentElement
  tag(commandContainer, 'battleCommandButtons')

  for (const button of commandButtons) {
    tag(button, 'battleCommandButton')
    const selected =
      button.hasAttribute('data-active') ||
      button.getAttribute('aria-pressed') === 'true' ||
      button.hasAttribute('data-selected') ||
      `${button.className}`.includes('commandActive')
    if (selected) tag(button, 'battleCommandSelected')
    else clearTag(button, 'battleCommandSelected')
  }

  const facingButtons = Array.from(
    commandDeck.querySelectorAll<HTMLButtonElement>('button[aria-label^="Face "]'),
  )
  const facingPad = facingButtons[0]?.parentElement
  tag(facingPad, 'battleFacingPad')
  for (const button of facingButtons) tag(button, 'battleFacingButton')
}

function tagFooter(root: HTMLElement) {
  const footer = root.querySelector<HTMLElement>('footer')
  if (footer) tag(footer, 'battleVisual', 'footer')

  for (const button of root.querySelectorAll<HTMLButtonElement>('button')) {
    const copy = textOf(button)
    if (/^Chat$/i.test(copy)) tag(button, 'battleFooterAction', 'chat')
    else if (copy.includes('Cancel Action')) tag(button, 'battleFooterAction', 'cancel')
    else if (copy.includes('Confirm Action') || copy.includes('Committing')) {
      tag(button, 'battleFooterAction', 'confirm')
    } else if (copy.includes('Surrender') || copy.includes('Abort Battle')) {
      tag(button, 'battleFooterAction', 'danger')
    }
  }
}

function applyVisualContract() {
  const root = findBattleRoot()
  if (!root) return

  tag(root, 'battleVisualContract')
  tag(root, 'battleMode', root.dataset.pvpBattle === 'true' ? 'pvp' : 'pve')
  tagHeader(root)
  tagBattlefield(root)
  tagCommands(root)
  tagFooter(root)
}

export function BattleScreenVisualContract() {
  useEffect(() => {
    let frame: number | null = null

    const run = () => {
      frame = null
      applyVisualContract()
    }
    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(run)
    }

    run()
    const root = findBattleRoot() ?? document.body
    const observer = new MutationObserver(schedule)
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'class', 'data-active', 'data-selected', 'aria-pressed'],
    })

    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <span className={styles.hook} aria-hidden="true" />
}
