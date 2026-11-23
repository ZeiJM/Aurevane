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

/** Historical payloads keep their bytes; new exact Item values survive jsonb key ordering. */
export function fingerprintCombatSnapshot(
  snapshot: Omit<CombatBuildSnapshot, 'fingerprint'>,
): string {
  const canonicalValue = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonicalValue)
      : value !== null && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([key, child]) => [key, canonicalValue(child)]),
          )
        : value
  const payload = {
    ...snapshot,
    extensions: {
      ...snapshot.extensions,
      equipmentSkills: canonicalValue(snapshot.extensions.equipmentSkills),
    },
  }
  return `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`
}

export function toCombatBuildSnapshot(
  committed: CharacterCommittedBuildSnapshotRecord,
): CombatBuildSnapshot {
  const payload = {
    schemaVersion: COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION,
    sourceBuildSchemaVersion: committed.schemaVersion,
    sourceBuildVersion: committed.buildVersion,
    ...(committed.skillEligibilityPolicyVersion === 1
      ? { skillEligibilityPolicyVersion: 1 as const }
      : {}),
    primary: { ...committed.primary },
    secondary: committed.secondary ? { ...committed.secondary } : null,
    disciplineSkills: [...committed.disciplineSkills]
      .sort((left, right) => left.slotIndex - right.slotIndex)
      .map((skill) => ({ ...skill })),
    ...(committed.supportActionId === undefined
      ? {}
      : { supportActionId: committed.supportActionId }),
    extensions: {
      resonance: committed.extensions.resonance
        ? {
            ...committed.extensions.resonance,
            disciplinePair: [...committed.extensions.resonance.disciplinePair] as [string, string],
          }
        : null,
      essence: committed.extensions.essence ? { ...committed.extensions.essence } : null,
      equipmentSkills: structuredClone(committed.extensions.equipmentSkills),
      supernatural: null,
      prestige: null,
    },
  }
  const fingerprint = fingerprintCombatSnapshot(payload)
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
