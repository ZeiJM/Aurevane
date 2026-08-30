'use client'

import { useEffect } from 'react'

import styles from './battle-cockpit-layout-stabilizer.module.css'

function hideFacingPads() {
  document
    .querySelectorAll<HTMLElement>('[data-unified-facing-pad="true"]')
    .forEach((pad) => pad.style.setProperty('display', 'none', 'important'))
}

function syncFinishTurnCopy() {
  hideFacingPads()

  const deck = document.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
  if (!deck) return
  const button = Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) =>
      candidate.querySelector(':scope > strong')?.textContent?.trim() === 'Finish Turn',
  )
  const cost = button?.querySelector<HTMLElement>(':scope > small')
  if (cost && cost.textContent !== 'Choose facing + end') cost.textContent = 'Choose facing + end'
}

export function BattleCockpitLayoutStabilizer({ playerName }: { playerName: string }) {
  useEffect(() => {
    void styles
    void playerName

    // The compact native facing pad stays out of the shared cockpit layout, but its real controls
    // remain enabled when Finish Turn enters facing mode. The battlefield facing guides invoke those
    // same server-authoritative controls after a deliberate double tap; this stabilizer must not
    // auto-commit the current direction from a single Finish Turn tap.
    syncFinishTurnCopy()
    const observer = new MutationObserver(syncFinishTurnCopy)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-open'],
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [playerName])

  return null
}
