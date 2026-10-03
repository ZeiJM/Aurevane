'use client'

import { BattleInfoPopover } from './battle-info-popover'
import {
  BATTLE_TERRAIN_KEY_DETAILS,
  presentBattleTerrainKeys,
  type BattleTerrainKeyKind,
  type BattleTerrainKeySnapshot,
} from './battle-terrain-key-presentation'
import styles from './battle-map-key.module.css'

export function BattleMapKey({ snapshot }: { snapshot: BattleTerrainKeySnapshot }) {
  const activeKeys = new Set(presentBattleTerrainKeys(snapshot))
  const terrainKeys = Object.keys(BATTLE_TERRAIN_KEY_DETAILS) as BattleTerrainKeyKind[]

  return (
    <section className={styles.inline} aria-label="Terrain Key" data-battle-terrain-key="true">
      <header>
        <strong>Terrain Key</strong>
      </header>
      <div className={styles.samples}>
        {terrainKeys.map((kind) => {
          const terrain = BATTLE_TERRAIN_KEY_DETAILS[kind]
          const active = activeKeys.has(kind)
          return (
            <BattleInfoPopover
              key={kind}
              label={terrain.name}
              description={active ? 'Active in this battle' : 'Inactive in this battle'}
              className={styles.sample}
              trigger={
                <>
                  <i data-key={kind} data-terrain-active={active} aria-hidden="true">
                    {terrain.glyph}
                  </i>
                  <span>{terrain.name}</span>
                  <small className={styles.status} data-terrain-active={active}>
                    <b aria-hidden="true">●</b> {active ? 'Active' : 'Inactive'}
                  </small>
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
