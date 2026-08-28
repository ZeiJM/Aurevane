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

    setBattlefield(target)

    return () => {
      delete target.dataset.aiTerrainLayout
      if (legacyLegend) {
        delete legacyLegend.dataset.aiLegacyTerrainLegend
        legacyLegend.removeAttribute('aria-hidden')
      }
      setBattlefield(null)
    }
  }, [])

  if (!battlefield) return null

  return createPortal(
    <div className={styles.legend} aria-label="Terrain legend" data-ai-native-terrain-legend="true">
      <span className={styles.terrainKey}>
        <i className={styles.roughKey} aria-hidden="true" />
        <span>
          <b>Difficult Ground</b>
          <small>Higher movement cost</small>
        </span>
      </span>
      <span className={styles.terrainKey}>
        <i className={styles.raisedKey} aria-hidden="true">
          ▲
        </i>
        <span>
          <b>Raised Ground</b>
          <small>Elevation +1</small>
        </span>
      </span>
    </div>,
    battlefield,
  )
}
