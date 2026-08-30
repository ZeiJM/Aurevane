'use client'

import { useEffect } from 'react'

import styles from './battle-pve-command-context-parity.module.css'

function syncPveContext(root: HTMLElement): void {
  const strip = root.querySelector<HTMLElement>('[data-testid="combat-mode-instruction"]')
  if (!strip) return

  strip.dataset.pvePvpContextParity = 'true'
  strip.dataset.battleInstructionHost = 'true'
  strip.dataset.battleInstructionRow = 'true'

  const portal = strip.firstElementChild
  if (portal instanceof HTMLElement) {
    portal.dataset.pveQualityPortal = 'true'
    delete portal.dataset.battleInstructionRow
  }

  const title = strip.querySelector<HTMLElement>(':scope > strong')
  if (title) title.dataset.battleInstructionTitle = 'true'

  const description = Array.from(strip.children).find(
    (child): child is HTMLSpanElement =>
      child instanceof HTMLSpanElement &&
      !child.hasAttribute('data-battle-target-preview') &&
      !child.hasAttribute('data-ai-turn-clock'),
  )
  if (description) description.dataset.battleInstructionDescription = 'true'

  const timer = strip.querySelector<HTMLElement>('[data-ai-turn-clock="true"]')
  const timerValue = timer?.querySelector<HTMLElement>(':scope > span:first-child') ?? null
  if (timer) timer.dataset.sharedTurnClock = 'true'
  if (timerValue) {
    const match = timerValue.textContent?.trim().match(/^(\d+)s left$/)
    if (match?.[1]) timerValue.textContent = `${match[1]}s`
  }
}

export function BattlePveCommandContextParity() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('main[data-battle-kind="pve"]')
    if (!root) return

    let frame = 0
    const sync = () => {
      frame = 0
      syncPveContext(root)
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
      characterData: true,
      attributes: true,
      attributeFilter: ['data-battle-instruction-row'],
    })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <span className={styles.hook} aria-hidden="true" />
}
