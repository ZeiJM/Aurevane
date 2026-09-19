import 'server-only'

import { createHash } from 'node:crypto'

import {
  COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION,
  validateCombatBuildSnapshot,
  type CombatBuildSnapshot,
} from '@aurevane/game-core/combat/build-snapshot'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
  type EssenceDefinition,
  type EssenceSnapshotReference,
} from '@aurevane/game-core/combat/essence'
import {
  resolveMatureSkillVersion,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import type { CombatTemporarySkillGrant } from '@aurevane/game-core/combat/combat-effect-state'
import {
  resonanceSnapshotReference,
  resolveResonanceForPair,
  type ResonanceDefinition,
  type ResonanceSnapshotReference,
} from '@aurevane/game-core/combat/resonance'

import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'

export const BATTLE_BUILD_AUTHORITY_SCHEMA_VERSION = 1 as const

export interface BattleBuildAuthorityCombatantSnapshot {
  combatantId: string
  characterId: string
  snapshotSchemaVersion: typeof COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION
  buildSchemaVersion: number
  buildVersion: number
  fingerprint: string
  primary: CharacterCommittedBuildSnapshotRecord['primary']
  secondary: CharacterCommittedBuildSnapshotRecord['secondary']
  disciplineSkills: CharacterCommittedBuildSnapshotRecord['disciplineSkills']
  extensions: {
    resonance: ResonanceSnapshotReference | null
    essence: EssenceSnapshotReference | null
  }
}

export interface BattleBuildAuthoritySnapshot {
  /** Absent on frozen pre-Phase-4 battles, where Ironfist had no signatures. */
  catalogVersion?: 2 | 3
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
  if (
    !isRecord(value) ||
    !Array.isArray(value.disciplinePair) ||
    value.disciplinePair.length !== 2
  ) {
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

function parseDisciplineSkills(
  value: unknown,
): CharacterCommittedBuildSnapshotRecord['disciplineSkills'] | null {
  if (!Array.isArray(value)) return null
  const parsed: Array<CharacterCommittedBuildSnapshotRecord['disciplineSkills'][number]> = []
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      !positiveInteger(candidate.slotIndex) ||
      !nonEmptyString(candidate.skillId) ||
      !positiveInteger(candidate.contentVersion) ||
      !nonEmptyString(candidate.sourceDisciplineId)
    ) {
      return null
    }
    parsed.push({
      slotIndex: candidate.slotIndex,
      skillId: candidate.skillId,
      contentVersion: candidate.contentVersion,
      sourceDisciplineId: candidate.sourceDisciplineId,
    })
  }
  return parsed.sort((left, right) => left.slotIndex - right.slotIndex)
}

function combatSnapshotFromCommitted(
  snapshot: CharacterCommittedBuildSnapshotRecord,
): Omit<CombatBuildSnapshot, 'fingerprint'> {
  return {
    schemaVersion: COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION,
    sourceBuildSchemaVersion: snapshot.schemaVersion,
    sourceBuildVersion: snapshot.buildVersion,
    primary: { ...snapshot.primary },
    secondary: snapshot.secondary ? { ...snapshot.secondary } : null,
    disciplineSkills: [...snapshot.disciplineSkills]
      .sort((left, right) => left.slotIndex - right.slotIndex)
      .map((skill) => ({ ...skill })),
    extensions: {
      resonance: snapshot.extensions.resonance
        ? {
            ...snapshot.extensions.resonance,
            disciplinePair: [...snapshot.extensions.resonance.disciplinePair] as [string, string],
          }
        : null,
      essence: snapshot.extensions.essence ? { ...snapshot.extensions.essence } : null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

function fingerprintCombatSnapshot(snapshot: Omit<CombatBuildSnapshot, 'fingerprint'>): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')}`
}

function validateCanonicalCombatSnapshot(
  snapshot: CombatBuildSnapshot,
  allowPublishedSkillVersions = false,
): boolean {
  if (validateCombatBuildSnapshot(snapshot).length > 0) return false
  for (const skill of snapshot.disciplineSkills) {
    const definition = resolveMatureSkillVersion(skill.skillId, skill.contentVersion)
    if (definition && definition.sourceDisciplineId !== skill.sourceDisciplineId) return false
    if (!definition && !allowPublishedSkillVersions) return false
  }
  return (
    fingerprintCombatSnapshot({
      schemaVersion: snapshot.schemaVersion,
      sourceBuildSchemaVersion: snapshot.sourceBuildSchemaVersion,
      sourceBuildVersion: snapshot.sourceBuildVersion,
      primary: snapshot.primary,
      secondary: snapshot.secondary,
      disciplineSkills: snapshot.disciplineSkills,
      extensions: snapshot.extensions,
    }) === snapshot.fingerprint
  )
}

function parseCombatant(
  value: unknown,
  legacyCatalog: boolean,
  allowPublishedSkillVersions: boolean,
): BattleBuildAuthorityCombatantSnapshot | null {
  if (!isRecord(value) || !isRecord(value.primary) || !isRecord(value.extensions)) return null
  if (
    !nonEmptyString(value.combatantId) ||
    !nonEmptyString(value.characterId) ||
    value.combatantId !== `character:${value.characterId}` ||
    value.snapshotSchemaVersion !== COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION ||
    !positiveInteger(value.buildSchemaVersion) ||
    !positiveInteger(value.buildVersion) ||
    !nonEmptyString(value.fingerprint) ||
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

  const disciplineSkills = parseDisciplineSkills(value.disciplineSkills)
  const resonance = parseResonanceReference(value.extensions.resonance)
  const essence = parseEssenceReference(value.extensions.essence)
  if (!disciplineSkills || resonance === undefined || essence === undefined) return null

  const combatSnapshot: CombatBuildSnapshot = {
    schemaVersion: COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION,
    sourceBuildSchemaVersion: value.buildSchemaVersion,
    sourceBuildVersion: value.buildVersion,
    fingerprint: value.fingerprint,
    primary: {
      disciplineId: value.primary.disciplineId,
      definitionVersion: value.primary.definitionVersion,
      profileVersion: value.primary.profileVersion,
    },
    secondary,
    disciplineSkills,
    extensions: {
      resonance,
      essence,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
  if (!validateCanonicalCombatSnapshot(combatSnapshot, allowPublishedSkillVersions)) return null

  const secondaryDisciplineId = secondary?.disciplineId ?? null
  // Preserve old server-owned snapshots exactly; never inject newly authored content.
  const legacyIronfist =
    legacyCatalog &&
    (value.primary.disciplineId === 'ironfist' || secondaryDisciplineId === 'ironfist') &&
    !disciplineSkills.some((skill) => skill.sourceDisciplineId === 'ironfist')
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
  } else if (
    !legacyIronfist &&
    resolveResonanceForPair(value.primary.disciplineId, secondaryDisciplineId)
  ) {
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
  } else if (
    !legacyIronfist &&
    resolveEssenceForBuild(value.primary.disciplineId, secondaryDisciplineId)
  ) {
    return null
  }

  return {
    combatantId: value.combatantId,
    characterId: value.characterId,
    snapshotSchemaVersion: COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION,
    buildSchemaVersion: value.buildSchemaVersion,
    buildVersion: value.buildVersion,
    fingerprint: value.fingerprint,
    primary: combatSnapshot.primary,
    secondary,
    disciplineSkills,
    extensions: { resonance, essence },
  }
}

export function parseBattleBuildAuthoritySnapshot(
  value: unknown,
): BattleBuildAuthoritySnapshot | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== BATTLE_BUILD_AUTHORITY_SCHEMA_VERSION ||
    (value.catalogVersion !== undefined &&
      value.catalogVersion !== 2 &&
      value.catalogVersion !== 3) ||
    (value.combatContext !== 'pve' && value.combatContext !== 'pvp') ||
    !Array.isArray(value.combatants) ||
    value.combatants.length === 0
  ) {
    return null
  }

  const combatants: BattleBuildAuthorityCombatantSnapshot[] = []
  const seen = new Set<string>()
  for (const candidate of value.combatants) {
    const combatant = parseCombatant(
      candidate,
      value.catalogVersion === undefined,
      value.catalogVersion === 3,
    )
    if (!combatant || seen.has(combatant.combatantId)) return null
    seen.add(combatant.combatantId)
    combatants.push(combatant)
  }

  return {
    schemaVersion: BATTLE_BUILD_AUTHORITY_SCHEMA_VERSION,
    ...(value.catalogVersion === 2
      ? { catalogVersion: 2 as const }
      : value.catalogVersion === 3
        ? { catalogVersion: 3 as const }
        : {}),
    combatContext: value.combatContext,
    combatants,
  }
}

function createBattleBuildAuthoritySnapshotForCatalog(
  combatContext: MatureSkillCombatContext,
  inputs: readonly BattleBuildAuthorityInput[],
  catalogVersion: 2 | 3,
): BattleBuildAuthoritySnapshot {
  const value = {
    schemaVersion: BATTLE_BUILD_AUTHORITY_SCHEMA_VERSION,
    catalogVersion,
    combatContext,
    combatants: inputs.map(({ combatantId, characterId, snapshot }) => {
      const combatSnapshot = combatSnapshotFromCommitted(snapshot)
      return {
        combatantId,
        characterId,
        snapshotSchemaVersion: combatSnapshot.schemaVersion,
        buildSchemaVersion: combatSnapshot.sourceBuildSchemaVersion,
        buildVersion: combatSnapshot.sourceBuildVersion,
        fingerprint: fingerprintCombatSnapshot(combatSnapshot),
        primary: { ...combatSnapshot.primary },
        secondary: combatSnapshot.secondary ? { ...combatSnapshot.secondary } : null,
        disciplineSkills: combatSnapshot.disciplineSkills.map((skill) => ({ ...skill })),
        extensions: {
          resonance: combatSnapshot.extensions.resonance
            ? {
                ...combatSnapshot.extensions.resonance,
                disciplinePair: [...combatSnapshot.extensions.resonance.disciplinePair] as [
                  string,
                  string,
                ],
              }
            : null,
          essence: combatSnapshot.extensions.essence
            ? { ...combatSnapshot.extensions.essence }
            : null,
        },
      }
    }),
  }
  const parsed = parseBattleBuildAuthoritySnapshot(value)
  if (!parsed) throw new TypeError('Cannot create an invalid battle build-authority snapshot.')
  return parsed
}

export function createBattleBuildAuthoritySnapshot(
  combatContext: MatureSkillCombatContext,
  inputs: readonly BattleBuildAuthorityInput[],
): BattleBuildAuthoritySnapshot {
  return createBattleBuildAuthoritySnapshotForCatalog(combatContext, inputs, 2)
}

export async function createResolvedBattleBuildAuthoritySnapshot(
  combatContext: MatureSkillCombatContext,
  inputs: readonly BattleBuildAuthorityInput[],
  resolver: CombatContentResolver,
): Promise<BattleBuildAuthoritySnapshot> {
  const resolvedInputs: BattleBuildAuthorityInput[] = []

  for (const input of inputs) {
    const disciplineSkills: CharacterCommittedBuildSnapshotRecord['disciplineSkills'][number][] = []
    for (const skill of input.snapshot.disciplineSkills) {
      const definition = await resolver.resolveCurrentSkillDefinition(skill.skillId)
      if (!definition || !definition.enabled) {
        throw new TypeError(`Skill ${skill.skillId} has no enabled current combat definition.`)
      }
      if (definition.sourceDisciplineId !== skill.sourceDisciplineId) {
        throw new TypeError(
          `Published Skill ${skill.skillId} changed source Discipline from ${skill.sourceDisciplineId} to ${definition.sourceDisciplineId}.`,
        )
      }
      disciplineSkills.push({
        ...skill,
        contentVersion: definition.contentVersion,
      })
    }

    resolvedInputs.push({
      ...input,
      snapshot: {
        ...input.snapshot,
        disciplineSkills,
      },
    })
  }

  return createBattleBuildAuthoritySnapshotForCatalog(combatContext, resolvedInputs, 3)
}

export function battleBuildAuthorityForCombatant(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  combatantId: string,
): BattleBuildAuthorityCombatantSnapshot | null {
  return authority?.combatants.find((candidate) => candidate.combatantId === combatantId) ?? null
}

async function resolvePinnedBattleSkillDefinition(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  skillId: string,
  contentVersion: number,
  resolver?: CombatContentResolver,
): Promise<MatureSkillDefinition | null> {
  const definition =
    authority?.catalogVersion === 3
      ? resolver
        ? await resolver.resolvePinnedSkillDefinition(skillId, contentVersion)
        : null
      : resolveMatureSkillVersion(skillId, contentVersion)
  return definition ? structuredClone(definition) : null
}

export async function resolveBattleDisciplineSkillDefinition(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  combatantId: string,
  skillId: string,
  resolver?: CombatContentResolver,
): Promise<MatureSkillDefinition | null> {
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  const reference = build?.disciplineSkills.find((skill) => skill.skillId === skillId)
  if (!reference) return null

  const definition = await resolvePinnedBattleSkillDefinition(
    authority,
    reference.skillId,
    reference.contentVersion,
    resolver,
  )
  if (!definition || definition.sourceDisciplineId !== reference.sourceDisciplineId) return null
  return definition
}

export async function resolveBattleDisciplineSkillDefinitions(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  combatantId: string,
  resolver?: CombatContentResolver,
): Promise<readonly MatureSkillDefinition[] | null> {
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  if (!build) return null

  const definitions: MatureSkillDefinition[] = []
  for (const reference of [...build.disciplineSkills].sort(
    (left, right) => left.slotIndex - right.slotIndex,
  )) {
    const definition = await resolvePinnedBattleSkillDefinition(
      authority,
      reference.skillId,
      reference.contentVersion,
      resolver,
    )
    if (!definition || definition.sourceDisciplineId !== reference.sourceDisciplineId) return null
    definitions.push(definition)
  }
  return definitions
}

export async function resolveBattleTemporarySkillDefinition(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  grant: CombatTemporarySkillGrant,
  resolver?: CombatContentResolver,
): Promise<MatureSkillDefinition | null> {
  const sourceBuild = battleBuildAuthorityForCombatant(authority, grant.sourceCombatantId)
  const sourceReference = sourceBuild?.disciplineSkills.find(
    (reference) =>
      reference.skillId === grant.skillId && reference.contentVersion === grant.contentVersion,
  )
  if (!sourceReference) return null

  const definition = await resolvePinnedBattleSkillDefinition(
    authority,
    grant.skillId,
    grant.contentVersion,
    resolver,
  )
  if (!definition || definition.sourceDisciplineId !== sourceReference.sourceDisciplineId)
    return null
  return definition
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
