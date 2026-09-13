'use client'

import { BattleCommittedAudio } from './battle-committed-audio'
import { BattleMapTokenPolish } from './battle-map-token-polish'
import { BattleTerrainPresentationPolish } from './battle-terrain-presentation-polish'
import styles from './battlefield-presentation-bundle.module.css'

interface BattlefieldPresentationBundleProps {
  battleSessionId: string
  initialVersion: number
  mode: 'pve' | 'pvp'
  playerName?: string
  combatantAccents?: Readonly<Record<string, string>>
}

/**
 * Shared, read-only battlefield presentation authority.
 *
 * Playable battles and spectator battles both mount this bundle so terrain materials and combatant identity rings cannot silently drift between the two surfaces. Keep
 * interaction/mechanics outside this bundle; add future battlefield-only visual polish here when it
 * is equally valid for a read-only spectator.
 */
export function BattlefieldPresentationBundle({
  battleSessionId,
  initialVersion,
  mode,
  playerName,
  combatantAccents = {},
}: BattlefieldPresentationBundleProps) {
  return (
    <>
      <BattleCommittedAudio
        key={battleSessionId}
        battleSessionId={battleSessionId}
        initialVersion={initialVersion}
        mode={mode}
      />
      <BattleTerrainPresentationPolish />
      <BattleMapTokenPolish playerName={playerName} combatantAccents={combatantAccents} />
      <span className={styles.hook} aria-hidden="true" />
    </>
  )
}
