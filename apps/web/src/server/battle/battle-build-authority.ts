import 'server-only'

import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
  type EssenceDefinition,
  type EssenceSnapshotReference,
} from '@aurevane/game-core/combat/essence'
import type { MatureSkillCombatContext } from '@aurevane/game-core/combat/mature-skills'
import {
  resonanceSnapshotReference,
  resolveResonanceForPair,
  type ResonanceDefinition,
  type ResonanceSnapshotReference,
} from '@aurevane/game-core/combat/resonance'

import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'

export const BATTLE_BUILD_AUTHORITY_SCHEMA_VERSION = 1 as const

export interface BattleBuildAuthorityCombatantSnapshot {
  combatantId: string
  characterId: string
  buildSchemaVersion: number
  buildVersion: number
  primary: CharacterCommittedBuildSnapshotRecord['primary']
  secondary: CharacterCommittedBuildSnapshotRecord['secondary']
  extensions: {
    resonance: ResonanceSnapshotReference | null
    essence: EssenceSnapshotReference | null
  }
}

export interface BattleBuildAuthoritySnapshot {
  schemaVersion: typeof BATTLE_BUILD_AUTHORITY_SCHEMA_VERSION
  combatContext: MatureSkillCombatContext
  combatants: readonly BattleBuildAuthorityCombatantSnapshot[]
}

interface BattleBuildAuthorityInput {
  combatantId: string
  characterId: string
  snapshot: CharacterCommittedBuildSnapshotRecord
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function parseResonanceReference(value: unknown): ResonanceSnapshotReference | null | undefined {
  if (value === null) return null
  if (!isRecord(value) || !Array.isArray(value.disciplinePair) || value.disciplinePair.length !== 2) {
    return undefined
  }
  if (
    !nonEmptyString(value.resonanceId) ||
    !positiveInteger(value.contentVersion) ||
    !nonEmptyString(value.disciplinePair[0]) ||
    !nonEmptyString(value.disciplinePair[1])
  ) {
    return undefined
  }
  return {
    resonanceId: value.resonanceId,
    contentVersion: value.contentVersion,
    disciplinePair: [value.disciplinePair[0], value.disciplinePair[1]],
  }
}

function parseEssenceReference(value: unknown): EssenceSnapshotReference | null | undefined {
  if (value === null) return null
  if (
    !isRecord(value) ||
    !nonEmptyString(value.essenceId) ||
    !positiveInteger(value.contentVersion) ||
    !nonEmptyString(value.sourceDisciplineId) ||
    !nonEmptyString(value.skillId) ||
    !positiveInteger(value.skillContentVersion)
  ) {
    return undefined
  }
  return {
    essenceId: value.essenceId,
    contentVersion: value.contentVersion,
    sourceDisciplineId: value.sourceDisciplineId,
    skillId: value.skillId,
    skillContentVersion: value.skillContentVersion,
  }
}

function parseCombatant(value: unknown): BattleBuildAuthorityCombatantSnapshot | null {
  if (!isRecord(value) || !isRecord(value.primary) || !isRecord(value.extensions)) return null
  if (
    !nonEmptyString(value.combatantId) ||
    !nonEmptyString(value.characterId) ||
    value.combatantId !== `character:${value.characterId}` ||
    !positiveInteger(value.buildSchemaVersion) ||
    !positiveInteger(value.buildVersion) ||
    !nonEmptyString(value.primary.disciplineId) ||
    !positiveInteger(value.primary.definitionVersion) ||
    !positiveInteger(value.primary.profileVersion)
  ) {
    return null
  }

  let secondary: CharacterCommittedBuildSnapshotRecord['secondary'] = null
  if (value.secondary !== null) {
    if (
      !isRecord(value.secondary) ||
      !nonEmptyString(value.secondary.disciplineId) ||
      !positiveInteger(value.secondary.definitionVersion) ||
      value.secondary.disciplineId === value.primary.disciplineId
    ) {
      return null
    }
    secondary = {
      disciplineId: value.secondary.disciplineId,
      definitionVersion: value.secondary.definitionVersion,
    }
  }

  const resonance = parseResonanceReference(value.extensions.resonance)
  const essence = parseEssenceReference(value.extensions.essence)
  if (resonance === undefined || essence === undefined) return null

  const secondaryDisciplineId = secondary?.disciplineId ?? null
  const expectedResonance = resolveResonanceForPair(
    value.primary.disciplineId,
    secondaryDisciplineId,
    resonance?.contentVersion,
  )
  if (resonance) {
    if (!expectedResonance) return null
    const expected = resonanceSnapshotReference(expectedResonance)
    if (
      expected.resonanceId !== resonance.resonanceId ||
      expected.contentVersion !== resonance.contentVersion ||
      expected.disciplinePair[0] !== resonance.disciplinePair[0] ||
      expected.disciplinePair[1] !== resonance.disciplinePair[1]
    ) {
      return null
    }
  } else if (resolveResonanceForPair(value.primary.disciplineId, secondaryDisciplineId)) {
    return null
  }

  const expectedEssence = resolveEssenceForBuild(
    value.primary.disciplineId,
    secondaryDisciplineId,
    essence?.contentVersion,
  )
  if (essence) {
    if (!expectedEssence) return null
    const expected = essenceSnapshotReference(expectedEssence)
    if (
      expected.essenceId !== essence.essenceId ||
      expected.contentVersion !== essence.contentVersion ||
      expected.sourceDisciplineId !== essence.sourceDisciplineId ||
      expected.skillId !== essence.skillId ||
      expected.skillContentVersion !== essence.skillContentVersion
    ) {
      return null
    }
  } else if (resolveEssenceForBuild(value.primary.disciplineId, secondaryDisciplineId)) {
    return null
  }

  return {
    combatantId: value.combatantId,
    characterId: value.characterId,
    buildSchemaVersion: value.buildSchemaVersion,
    buildVersion: value.buildVersion,
    primary: {
      disciplineId: value.primary.disciplineId,
      definitionVersion: value.primary.definitionVersion,
      profileVersion: value.primary.profileVersion,
    },
    secondary,
    extensions: { resonance, essence },
  }
}

export function parseBattleBuildAuthoritySnapshot(value: unknown): BattleBuildAuthoritySnapshot | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== BATTLE_BUILD_AUTHORITY_SCHEMA_VERSION ||
    (value.combatContext !== 'pve' && value.combatContext !== 'pvp') ||
    !Array.isArray(value.combatants) ||
    value.combatants.length === 0
  ) {
    return null
  }

  const combatants: BattleBuildAuthorityCombatantSnapshot[] = []
  const seen = new Set<string>()
  for (const candidate of value.combatants) {
    const combatant = parseCombatant(candidate)
    if (!combatant || seen.has(combatant.combatantId)) return null
    seen.add(combatant.combatantId)
    combatants.push(combatant)
  }

  return {
    schemaVersion: BATTLE_BUILD_AUTHORITY_SCHEMA_VERSION,
    combatContext: value.combatContext,
    combatants,
  }
}

export function createBattleBuildAuthoritySnapshot(
  combatContext: MatureSkillCombatContext,
  inputs: readonly BattleBuildAuthorityInput[],
): BattleBuildAuthoritySnapshot {
  const value = {
    schemaVersion: BATTLE_BUILD_AUTHORITY_SCHEMA_VERSION,
    combatContext,
    combatants: inputs.map(({ combatantId, characterId, snapshot }) => ({
      combatantId,
      characterId,
      buildSchemaVersion: snapshot.schemaVersion,
      buildVersion: snapshot.buildVersion,
      primary: { ...snapshot.primary },
      secondary: snapshot.secondary ? { ...snapshot.secondary } : null,
      extensions: {
        resonance: snapshot.extensions.resonance
          ? {
              ...snapshot.extensions.resonance,
              disciplinePair: [...snapshot.extensions.resonance.disciplinePair] as [string, string],
            }
          : null,
        essence: snapshot.extensions.essence ? { ...snapshot.extensions.essence } : null,
      },
    })),
  }
  const parsed = parseBattleBuildAuthoritySnapshot(value)
  if (!parsed) throw new TypeError('Cannot create an invalid battle build-authority snapshot.')
  return parsed
}

export function battleBuildAuthorityForCombatant(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  combatantId: string,
): BattleBuildAuthorityCombatantSnapshot | null {
  return authority?.combatants.find((candidate) => candidate.combatantId === combatantId) ?? null
}

export function resolveBattleEssenceDefinition(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  combatantId: string,
): EssenceDefinition | null {
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  const reference = build?.extensions.essence
  if (!build || !reference) return null
  const definition = resolveEssenceForBuild(
    build.primary.disciplineId,
    build.secondary?.disciplineId ?? null,
    reference.contentVersion,
  )
  if (!definition) return null
  const expected = essenceSnapshotReference(definition)
  return expected.essenceId === reference.essenceId &&
    expected.skillId === reference.skillId &&
    expected.skillContentVersion === reference.skillContentVersion
    ? definition
    : null
}

export function resolveBattleResonanceDefinition(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  combatantId: string,
): ResonanceDefinition | null {
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  const reference = build?.extensions.resonance
  if (!build || !reference) return null
  const definition = resolveResonanceForPair(
    build.primary.disciplineId,
    build.secondary?.disciplineId ?? null,
    reference.contentVersion,
  )
  if (!definition) return null
  const expected = resonanceSnapshotReference(definition)
  return expected.resonanceId === reference.resonanceId ? definition : null
}
