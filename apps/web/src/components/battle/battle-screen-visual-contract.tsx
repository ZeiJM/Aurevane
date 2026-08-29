'use client'

import { useEffect } from 'react'

import styles from './battle-screen-visual-contract.module.css'
import terrainLegendStyles from './battle-terrain-legend-visual-contract.module.css'
import headerStyles from './battle-unified-header-authority.module.css'

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? ''
}

function mark(element: Element | null, key: string, value = 'true') {
  if (!(element instanceof HTMLElement)) return
  if (element.dataset[key] !== value) element.dataset[key] = value
}

function findBattleRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#battlefield')?.closest<HTMLElement>('main') ?? null
}

function markSemanticControls(root: HTMLElement) {
  root.dataset.battleVisualContract = 'true'
  root.dataset.battleMode = root.dataset.pvpBattle === 'true' ? 'pvp' : 'pve'

  const header = root.querySelector<HTMLElement>(':scope > header')
  mark(header, 'battleSharedHeader')
  mark(header?.firstElementChild ?? null, 'battleSharedObjective')

  const economyTrack = header?.querySelector<HTMLElement>(
    '[role="progressbar"][aria-label="Action Economy remaining"]',
  )
  mark(economyTrack?.parentElement ?? null, 'battleSharedEconomy')

  for (const button of header?.querySelectorAll<HTMLButtonElement>('button') ?? []) {
    const copy = textOf(button)
    if (copy.includes('Victory Conditions')) mark(button, 'battleSharedHeaderAction', 'victory')
    if (copy.includes('Combat Log') || /^Round\s+\d+/i.test(copy)) {
      mark(button, 'battleSharedHeaderAction', 'round-log')
    }
  }

  const battlefield = root.querySelector<HTMLElement>('#battlefield')
  mark(battlefield, 'battleSharedBattlefield')

  for (const tile of battlefield?.querySelectorAll<HTMLButtonElement>('button[aria-label*="occupied by"]') ?? []) {
    const token = Array.from(tile.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && Boolean(child.querySelector(':scope > strong')),
    )
    mark(token ?? null, 'battleSharedToken')
  }

  const footer = root.querySelector<HTMLElement>(':scope > footer')
  mark(footer, 'battleSharedFooter')
  for (const button of footer?.querySelectorAll<HTMLButtonElement>('button') ?? []) {
    const copy = textOf(button)
    if (/^Chat\b/i.test(copy)) mark(button, 'battleSharedFooterAction', 'chat')
    else if (copy.includes('Cancel Action')) mark(button, 'battleSharedFooterAction', 'cancel')
    else if (copy.includes('Confirm Action') || copy.includes('Committing')) {
      mark(button, 'battleSharedFooterAction', 'confirm')
    } else if (copy.includes('Surrender') || copy.includes('Abort Battle')) {
      mark(button, 'battleSharedFooterAction', 'danger')
    }
  }
}

export function BattleScreenVisualContract() {
  useEffect(() => {
    const root = findBattleRoot()
    if (!root) return

    let frame = 0

    const sync = () => {
      frame = 0
      markSemanticControls(root)
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    const observer = new MutationObserver(schedule)
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class',
        'disabled',
        'data-active',
        'data-selected',
        'data-board-auto-fit',
        'aria-pressed',
      ],
    })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <span
      className={`${styles.hook} ${terrainLegendStyles.hook} ${headerStyles.hook}`}
      aria-hidden="true"
    />
  )
}
