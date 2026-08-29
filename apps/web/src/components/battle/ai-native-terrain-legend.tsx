'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import battleStyles from './battle-experience-v2.module.css'
import styles from './ai-terrain-legend-pvp-parity.module.css'

export function AiNativeTerrainLegend() {
  const [battlefield, setBattlefield] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(
      'section#battlefield[aria-label="Tactical battlefield"]',
    )
    const root = target?.closest<HTMLElement>('main') ?? null
    if (!target || root?.dataset.pvpBattle === 'true') return

    target.dataset.aiTerrainLayout = 'true'

    const legacyLegend = target.querySelector<HTMLElement>(
      `:scope > .${CSS.escape(battleStyles.legend)}`,
    )
    if (legacyLegend) {
      legacyLegend.dataset.aiLegacyTerrainLegend = 'true'
      legacyLegend.setAttribute('aria-hidden', 'true')
    }

    // Mount the portal on the next frame instead of synchronously setting React state from the
    // effect body. The visual result is unchanged while complying with the hooks lifecycle rule.
    const frame = window.requestAnimationFrame(() => setBattlefield(target))

    return () => {
      window.cancelAnimationFrame(frame)
      delete target.dataset.aiTerrainLayout
      if (legacyLegend) {
        delete legacyLegend.dataset.aiLegacyTerrainLegend
        legacyLegend.removeAttribute('aria-hidden')
      }
    }
  }, [])

  if (!battlefield) return null

  return createPortal(
    <div className={styles.legend} aria-label="Terrain legend" data-ai-native-terrain-legend="true">
      <span className={styles.terrainKey}>
        <i className={styles.roughKey} aria-hidden="true" />
        <span>
          <b>Difficult Terrain</b>
          <small>Higher movement cost</small>
        </span>
      </span>
      <span className={styles.terrainKey}>
        <i className={styles.raisedKey} aria-hidden="true">
          ▲
        </i>
        <span>
          <b>Elevated Ground</b>
          <small>Elevation +1</small>
        </span>
      </span>
    </div>,
    battlefield,
  )
}
