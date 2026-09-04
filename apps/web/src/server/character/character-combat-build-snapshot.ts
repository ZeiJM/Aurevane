import 'server-only'

import { createHash } from 'node:crypto'

import {
  COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION,
  validateCombatBuildSnapshot,
  type CombatBuildSnapshot,
} from '@aurevane/game-core/combat/build-snapshot'
import { AurevaneError } from '@aurevane/game-core/errors'

import {
  loadCharacterCommittedBuildSnapshot,
  type CharacterBuildRepository,
  type CharacterCommittedBuildSnapshotRecord,
} from './character-build-service'

export function toCombatBuildSnapshot(
  committed: CharacterCommittedBuildSnapshotRecord,
): CombatBuildSnapshot {
  const payload = {
    schemaVersion: COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION,
    sourceBuildSchemaVersion: committed.schemaVersion,
    sourceBuildVersion: committed.buildVersion,
    primary: { ...committed.primary },
    secondary: committed.secondary ? { ...committed.secondary } : null,
    disciplineSkills: [...committed.disciplineSkills]
      .sort((left, right) => left.slotIndex - right.slotIndex)
      .map((skill) => ({ ...skill })),
    extensions: {
      resonance: committed.extensions.resonance
        ? {
            ...committed.extensions.resonance,
            disciplinePair: [...committed.extensions.resonance.disciplinePair] as [string, string],
          }
        : null,
      essence: committed.extensions.essence ? { ...committed.extensions.essence } : null,
      equipmentSkills: [] as readonly never[],
      supernatural: null,
      prestige: null,
    },
  }
  const fingerprint = `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`
  const snapshot: CombatBuildSnapshot = { ...payload, fingerprint }
  const issues = validateCombatBuildSnapshot(snapshot)
  if (issues.length > 0) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      `The committed combat build is invalid: ${issues[0]?.message ?? 'unknown issue'}`,
    )
  }
  return snapshot
}

export async function loadCharacterCombatBuildSnapshot(
  userId: string,
  characterId: string,
  repository: CharacterBuildRepository,
): Promise<CombatBuildSnapshot> {
  return toCombatBuildSnapshot(
    await loadCharacterCommittedBuildSnapshot(userId, characterId, repository),
  )
}
