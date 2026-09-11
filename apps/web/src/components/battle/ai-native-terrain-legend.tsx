'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import battleStyles from './battle-experience-v2.module.css'
import styles from './ai-terrain-legend-pvp-parity.module.css'

function readBattlefield(): HTMLElement | null {
  const target = document.querySelector<HTMLElement>(
    'section#battlefield[aria-label="Tactical battlefield"]',
  )
  return target?.closest<HTMLElement>('main')?.dataset.pvpBattle === 'true' ? null : target
}

function subscribeBattlefield(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}

function serverBattlefield() {
  return null
}

export function AiNativeTerrainLegend() {
  const battlefield = useSyncExternalStore(subscribeBattlefield, readBattlefield, serverBattlefield)

  useEffect(() => {
    const target = battlefield
    if (!target) return

    target.setAttribute('data-ai-terrain-layout', 'true')

    const legacyLegend = target.querySelector<HTMLElement>(
      `:scope > .${CSS.escape(battleStyles.legend)}`,
    )
    if (legacyLegend) {
      legacyLegend.dataset.aiLegacyTerrainLegend = 'true'
      legacyLegend.setAttribute('aria-hidden', 'true')
    }

    return () => {
      target.removeAttribute('data-ai-terrain-layout')
      if (legacyLegend) {
        delete legacyLegend.dataset.aiLegacyTerrainLegend
        legacyLegend.removeAttribute('aria-hidden')
      }
    }
  }, [battlefield])

  if (!battlefield) return null

  return createPortal(
    <div
      className={styles.legend}
      aria-label="Terrain legend"
      data-ai-native-terrain-legend="true"
      data-ai-terrain-legend="true"
    >
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
