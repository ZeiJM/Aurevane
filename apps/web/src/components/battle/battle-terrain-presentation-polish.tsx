'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import styles from './battle-terrain-presentation-polish.module.css'

const TERRAIN_TERMINOLOGY = new Map([
  ['Difficult Ground', 'Difficult Terrain'],
  ['Raised Ground', 'Elevated Ground'],
])

const TERRAIN_LEGEND_SELECTOR = [
  "section[aria-label='Tactical battlefield'] > [aria-label='Terrain legend']",
  "section[aria-label='PvP tactical battlefield'] > [aria-label='Terrain legend']",
].join(', ')

const BATTLEFIELD_SELECTOR = [
  "section[aria-label='Tactical battlefield']",
  "section[aria-label='PvP tactical battlefield']",
].join(', ')

function syncTerrainPresentation(): HTMLElement | null {
  const legends = document.querySelectorAll<HTMLElement>(TERRAIN_LEGEND_SELECTOR)

  for (const legend of legends) {
    for (const key of legend.querySelectorAll<HTMLElement>(':scope > span')) {
      const label = key.querySelector<HTMLElement>('b')
      if (!label) continue

      const current = label.textContent?.trim() ?? ''
      const replacement = TERRAIN_TERMINOLOGY.get(current)
      if (replacement) label.textContent = replacement

      const resolvedLabel = replacement ?? current
      if (resolvedLabel === 'Elevated Ground') {
        const description = key.querySelector<HTMLElement>('small')
        if (description?.textContent?.trim() !== 'Access depends on Jump') {
          if (description) description.textContent = 'Access depends on Jump'
        }
      }
    }
  }

  return legends.item(0)
}

export function BattleTerrainPresentationPolish() {
  const [legend, setLegend] = useState<HTMLElement | null>(null)
  const [showCoordinates, setShowCoordinates] = useState(false)

  useEffect(() => {
    let frame = 0

    const run = () => {
      frame = 0
      const nextLegend = syncTerrainPresentation()
      setLegend((current) => (current === nextLegend ? current : nextLegend))
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(run)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    schedule()

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const battlefield = legend?.closest<HTMLElement>(BATTLEFIELD_SELECTOR) ?? null
    if (!battlefield) return

    if (showCoordinates) battlefield.dataset.showCoordinates = 'true'
    else delete battlefield.dataset.showCoordinates

    return () => {
      delete battlefield.dataset.showCoordinates
    }
  }, [legend, showCoordinates])

  return (
    <>
      <span className={styles.hook} aria-hidden="true" />
      {legend
        ? createPortal(
            <button
              type="button"
              className={styles.coordinateToggle}
              role="switch"
              aria-checked={showCoordinates}
              aria-label="Tile coordinates"
              title={`Tile coordinates: ${showCoordinates ? 'on' : 'off'}`}
              onClick={() => setShowCoordinates((current) => !current)}
            >
              <span>Coords</span>
              <i aria-hidden="true" />
            </button>,
            legend,
          )
        : null}
    </>
  )
}
