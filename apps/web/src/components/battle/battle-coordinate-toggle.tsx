'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import styles from './battle-coordinate-toggle.module.css'

const MOBILE_BATTLE_MEDIA = '(max-width: 820px)'

function applyCoordinateVisibility(battlefield: HTMLElement | null, showCoordinates: boolean) {
  if (!battlefield) return
  if (showCoordinates) battlefield.dataset.showCoordinates = 'true'
  else delete battlefield.dataset.showCoordinates
}

export function BattleCoordinateToggle() {
  const [legend, setLegend] = useState<HTMLElement | null>(null)
  const [showCoordinates, setShowCoordinates] = useState(false)
  const battlefieldRef = useRef<HTMLElement | null>(null)
  const showCoordinatesRef = useRef(false)

  useEffect(() => {
    let frame = 0
    const mobileMedia = window.matchMedia(MOBILE_BATTLE_MEDIA)

    const locate = () => {
      frame = 0
      const nextBattlefield = document.querySelector<HTMLElement>('section#battlefield')
      const nextLegend =
        nextBattlefield?.querySelector<HTMLElement>(':scope > [aria-label="Terrain legend"]') ?? null

      if (nextLegend) {
        // One shared component owns the responsive display primitive for both battle runtimes. This
        // defeats older mode-specific hide rules while the shared stylesheet owns all geometry.
        nextLegend.style.setProperty('display', mobileMedia.matches ? 'grid' : 'flex', 'important')
        nextLegend.style.setProperty('visibility', 'visible', 'important')
        nextLegend.style.setProperty('opacity', '1', 'important')
      }

      if (battlefieldRef.current !== nextBattlefield) {
        applyCoordinateVisibility(battlefieldRef.current, false)
        battlefieldRef.current = nextBattlefield
      }
      applyCoordinateVisibility(nextBattlefield, showCoordinatesRef.current)
      setLegend((current) => (current === nextLegend ? current : nextLegend))
    }

    const scheduleLocate = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    mobileMedia.addEventListener('change', scheduleLocate)
    const observer = new MutationObserver(scheduleLocate)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mobileMedia.removeEventListener('change', scheduleLocate)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      applyCoordinateVisibility(battlefieldRef.current, false)
      battlefieldRef.current = null
    }
  }, [])

  if (!legend) return null

  return createPortal(
    <button
      type="button"
      role="switch"
      aria-label="Tile coordinates"
      aria-checked={showCoordinates}
      className={styles.coordinateToggle}
      data-terrain-coordinate-toggle="true"
      onClick={() => {
        const nextShowCoordinates = !showCoordinates
        showCoordinatesRef.current = nextShowCoordinates
        setShowCoordinates(nextShowCoordinates)
        applyCoordinateVisibility(battlefieldRef.current, nextShowCoordinates)
      }}
    >
      <i aria-hidden="true" />
      <span>Coords</span>
    </button>,
    legend,
  )
}
