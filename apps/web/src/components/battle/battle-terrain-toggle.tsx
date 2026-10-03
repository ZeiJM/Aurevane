'use client'

import { BattleInfoPopover } from './battle-info-popover'
import { BattleMapKey } from './battle-map-key'
import type { BattleTerrainKeySnapshot } from './battle-terrain-key-presentation'
import styles from './battle-terrain-toggle.module.css'

/** Footer terrain help reuses the battle reading panel's dismissal and focus behavior. */
export function BattleTerrainToggle({ snapshot }: { snapshot: BattleTerrainKeySnapshot }) {
  return (
    <BattleInfoPopover
      label="Terrain"
      title="Terrain"
      consumeOutsideClick
      placement="above"
      className={styles.trigger}
      trigger={
        <>
          <span aria-hidden="true">▲</span> Terrain <span aria-hidden="true">⌄</span>
        </>
      }
    >
      <BattleMapKey snapshot={snapshot} compact />
    </BattleInfoPopover>
  )
}
