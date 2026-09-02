'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { useBattleSessionUiBoolean } from './battle-session-ui-state'
import styles from './battle-coordinate-toggle.module.css'

const MOBILE_BATTLE_MEDIA = '(max-width: 820px)'

export function BattleCoordinateToggle({ battleSessionId }: { battleSessionId: string }) {
  const [legend, setLegend] = useState<HTMLElement | null>(null)
  const [showCoordinates, setShowCoordinates] = useBattleSessionUiBoolean(
    battleSessionId,
    'coordinatesVisible',
  )

  useEffect(() => {
    let frame = 0
    const mobileMedia = window.matchMedia(MOBILE_BATTLE_MEDIA)

    const locate = () => {
      frame = 0
      const nextBattlefield = document.querySelector<HTMLElement>('section#battlefield')
      const nextLegend =
        nextBattlefield?.querySelector<HTMLElement>(':scope > [aria-label="Terrain legend"]') ??
        null

      if (nextLegend) {
        // One shared component owns the responsive display primitive for both battle runtimes. This
        // defeats older mode-specific hide rules while the shared stylesheet owns all geometry.
        nextLegend.style.setProperty('display', mobileMedia.matches ? 'grid' : 'flex', 'important')
        nextLegend.style.setProperty('visibility', 'visible', 'important')
        nextLegend.style.setProperty('opacity', '1', 'important')
      }

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
    }
  }, [])

  useEffect(() => {
    const sync = () => {
      const battlefield = document.querySelector<HTMLElement>('section#battlefield')
      if (!battlefield) return
      if (showCoordinates) battlefield.dataset.showCoordinates = 'true'
      else delete battlefield.dataset.showCoordinates
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      const battlefield = document.querySelector<HTMLElement>('section#battlefield')
      if (!battlefield) return
      delete battlefield.dataset.showCoordinates
    }
  }, [showCoordinates])

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
