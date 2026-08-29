'use client'

import { useEffect } from 'react'

import styles from './battle-terrain-presentation-polish.module.css'

const TERRAIN_TERMINOLOGY = new Map([
  ['Difficult Ground', 'Difficult Terrain'],
  ['Raised Ground', 'Elevated Ground'],
])

function syncTerrainTerminology(): void {
  for (const label of document.querySelectorAll<HTMLElement>(
    "[aria-label='Terrain legend'] b",
  )) {
    const current = label.textContent?.trim() ?? ''
    const replacement = TERRAIN_TERMINOLOGY.get(current)
    if (replacement) label.textContent = replacement
  }
}

export function BattleTerrainPresentationPolish() {
  useEffect(() => {
    let frame = 0

    const run = () => {
      frame = 0
      syncTerrainTerminology()
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(run)
    }

    run()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <span className={styles.hook} aria-hidden="true" />
}
