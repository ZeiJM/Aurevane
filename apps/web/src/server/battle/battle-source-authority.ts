import 'server-only'
import { createHash } from 'node:crypto'
import type { CharacterRecord } from '@aurevane/db/character'
import { AurevaneError } from '@aurevane/game-core/errors'

type CharacterSource = Pick<
  CharacterRecord,
  | 'level'
  | 'xp'
  | 'progressionCycle'
  | 'might'
  | 'finesse'
  | 'vitality'
  | 'agility'
  | 'intellect'
  | 'resolve'
>
/** Private admission proof, deliberately independent of display identity/presence. */
export function battleSourceHash(character: CharacterSource): string {
  return createHash('sha256')
    .update(
      [
        character.level,
        character.xp,
        character.progressionCycle,
        character.might,
        character.finesse,
        character.vitality,
        character.agility,
        character.intellect,
        character.resolve,
      ].join(':'),
    )
    .digest('hex')
}
export function assertPreparedBattleSource(
  character: CharacterSource,
  snapshot: { buildVersion: number; sourceHash?: unknown },
  activeBuildVersion?: number,
): void {
  if (
    (Object.hasOwn(snapshot, 'sourceHash') &&
      snapshot.sourceHash !== battleSourceHash(character)) ||
    (activeBuildVersion !== undefined && activeBuildVersion !== snapshot.buildVersion)
  ) {
    throw new AurevaneError(
      'STALE_VERSION',
      'The character or build changed while preparing this battle. Refresh and try again.',
    )
  }
}
