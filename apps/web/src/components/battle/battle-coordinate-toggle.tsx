'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import styles from './battle-coordinate-toggle.module.css'

export function BattleCoordinateToggle() {
  const [legend, setLegend] = useState<HTMLElement | null>(null)
  const [battlefield, setBattlefield] = useState<HTMLElement | null>(null)
  const [showCoordinates, setShowCoordinates] = useState(false)

  useEffect(() => {
    let frame = 0

    const locate = () => {
      frame = 0
      const nextBattlefield = document.querySelector<HTMLElement>('section#battlefield')
      const nextLegend =
        nextBattlefield?.querySelector<HTMLElement>(':scope > [aria-label="Terrain legend"]') ?? null

      if (nextLegend) {
        // Layout belongs to the shared stylesheet: desktop is a flex row and mobile is an equal
        // three-column grid. Do not pin display inline or runtime-specific CSS can never harmonize.
        nextLegend.style.removeProperty('display')
        nextLegend.style.setProperty('visibility', 'visible', 'important')
        nextLegend.style.setProperty('opacity', '1', 'important')
      }

      setBattlefield((current) => (current === nextBattlefield ? current : nextBattlefield))
      setLegend((current) => (current === nextLegend ? current : nextLegend))
    }

    const scheduleLocate = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(scheduleLocate)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!battlefield) return
    if (showCoordinates) battlefield.dataset.showCoordinates = 'true'
    else delete battlefield.dataset.showCoordinates

    return () => {
      delete battlefield.dataset.showCoordinates
    }
  }, [battlefield, showCoordinates])

  if (!legend) return null

  return createPortal(
    <button
      type="button"
      role="switch"
      aria-label="Tile coordinates"
      aria-checked={showCoordinates}
      className={styles.coordinateToggle}
      data-terrain-coordinate-toggle="true"
      onClick={() => setShowCoordinates((current) => !current)}
    >
      <i aria-hidden="true" />
      <span>Coords</span>
    </button>,
    legend,
  )
}
