'use client'

import { BattleInfoPopover } from './battle-info-popover'
import {
  BATTLE_TERRAIN_KEY_DETAILS,
  presentBattleTerrainKeys,
  type BattleTerrainKeySnapshot,
} from './battle-terrain-key-presentation'
import styles from './battle-map-key.module.css'

export function BattleMapKey({ snapshot }: { snapshot: BattleTerrainKeySnapshot }) {
  const terrainKeys = presentBattleTerrainKeys(snapshot)
  if (terrainKeys.length === 0) return null

  return (
    <section className={styles.inline} aria-label="Terrain Key" data-battle-terrain-key="true">
      <header>
        <strong>Terrain Key</strong>
      </header>
      <div className={styles.samples}>
        {terrainKeys.map((kind) => {
          const terrain = BATTLE_TERRAIN_KEY_DETAILS[kind]
          return (
            <BattleInfoPopover
              key={kind}
              label={terrain.name}
              className={styles.sample}
              trigger={
                <>
                  <i data-key={kind} aria-hidden="true">
                    {terrain.glyph}
                  </i>
                  <span>{terrain.name}</span>
                </>
              }
            >
              <p>{terrain.description}</p>
            </BattleInfoPopover>
          )
        })}
      </div>
    </section>
  )
}
