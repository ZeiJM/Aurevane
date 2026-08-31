'use client'

import { useEffect } from 'react'

import styles from './battle-stabilization-polish.module.css'

function clearLegacyMobileFacingMarkers(root: ParentNode = document): void {
  for (const native of root.querySelectorAll<HTMLElement>('[data-mobile-native-facing="true"]')) {
    native.style.removeProperty('visibility')
    delete native.dataset.mobileNativeFacing
  }
  for (const marker of root.querySelectorAll<HTMLElement>('[data-mobile-token-facing="true"]')) {
    marker.remove()
  }
}

export function BattleStabilizationPolish() {
  useEffect(() => {
    // Facing now comes from the shared BattleFacingIndicator for PvE, PvP, players, recruits, and
    // future combatants. Remove remnants of the old mobile-PvP Unicode compatibility renderer if a
    // client navigation or hot update left any behind; do not create a second visual indicator.
    clearLegacyMobileFacingMarkers()
    return () => clearLegacyMobileFacingMarkers()
  }, [])

  return <span className={styles.hook} aria-hidden="true" />
}
