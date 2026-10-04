'use client'

import { BattleInfoPopover } from './battle-info-popover'
import {
  BATTLE_TERRAIN_KEY_DETAILS,
  presentBattleTerrainKeys,
  type BattleTerrainKeyKind,
  type BattleTerrainKeySnapshot,
} from './battle-terrain-key-presentation'
import styles from './battle-map-key.module.css'

export function BattleMapKey({
  snapshot,
  compact = false,
}: {
  snapshot: BattleTerrainKeySnapshot
  compact?: boolean
}) {
  const activeKeys = new Set(presentBattleTerrainKeys(snapshot))
  const terrainKeys = Object.keys(BATTLE_TERRAIN_KEY_DETAILS) as BattleTerrainKeyKind[]

  return (
    <section
      className={`${styles.inline}${compact ? ` ${styles.compact}` : ''}`}
      aria-label="Terrain Key"
      data-battle-terrain-key="true"
    >
      <header>
        <strong>Terrain Key</strong>
      </header>
      <div className={styles.samples}>
        {terrainKeys.map((kind) => {
          const terrain = BATTLE_TERRAIN_KEY_DETAILS[kind]
          const active = activeKeys.has(kind)
          const sample = (
            <>
              <i data-key={kind} data-terrain-active={active} aria-hidden="true">
                {terrain.glyph}
              </i>
              <span>{terrain.name}</span>
              <small className={styles.status} data-terrain-active={active}>
                <b aria-hidden="true">●</b> {active ? 'Active' : 'Inactive'}
              </small>
            </>
          )
          if (compact) {
            return (
              <details key={kind} className={styles.entry} name="battle-terrain-help">
                <summary className={styles.sample} aria-label={terrain.name}>
                  {sample}
                </summary>
                <p>{terrain.description}</p>
              </details>
            )
          }
          return (
            <BattleInfoPopover
              key={kind}
              label={terrain.name}
              description={active ? 'Active in this battle' : 'Inactive in this battle'}
              className={styles.sample}
              trigger={sample}
            >
              <p>{terrain.description}</p>
            </BattleInfoPopover>
          )
        })}
      </div>
    </section>
  )
}
