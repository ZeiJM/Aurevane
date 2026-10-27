import { parseDisciplineSkillReference } from '@/server/character/discipline-skill-reference-parser'
import {
  captureBasicSkillSources,
  type BasicSkillId,
} from '@aurevane/game-core/combat/combat-basic-actions'
import 'server-only'
import { PRONOUN_PRESETS, type PronounPresetId } from '@aurevane/game-core/character/creation'
import type { CharacterRecord } from '@aurevane/db/character'

import {
  parseSupportActionId,
  type SupportActionId,
} from '@aurevane/game-core/combat/support-actions'
import { createHash } from 'node:crypto'

import {
  COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION,
  validateCombatBuildSnapshot,
  type CombatBuildSnapshot,
} from '@aurevane/game-core/combat/build-snapshot'
import {
  essenceSnapshotReference,
  validateEssenceDefinition,
  resolveEssenceForBuild,
  type EssenceDefinition,
  type EssenceSnapshotReference,
} from '@aurevane/game-core/combat/essence'
import {
  resolveMatureSkillVersion,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  resonanceSnapshotReference,
  validateResonanceDefinition,
  resolveResonanceForPair,
  type AnyResonanceDefinition,
  type ResonanceSnapshotReference,
} from '@aurevane/game-core/combat/resonance'

import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'
import {
  capturedMatureSkillAbilitySource,
  capturedResonanceAbilitySource,
} from '@aurevane/game-core/combat/combat-action-source'
import { essenceCombatSkill } from '@aurevane/game-core/combat/essence'
import type { CombatEncounterState } from '@aurevane/game-core/combat/actions'
import type { CapturedCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'

export const BATTLE_BUILD_AUTHORITY_SCHEMA_VERSION = 1 as const

export interface BattleNarratorIdentitySnapshot {
  name: string
  pronounPresetId?: PronounPresetId
}

export function narratorIdentityForCharacter(
  character: Pick<CharacterRecord, 'name' | 'pronounPresetId'>,
): BattleNarratorIdentitySnapshot {
  const pronouns = PRONOUN_PRESETS.find((preset) => preset.id === character.pronounPresetId)
  return { name: character.name, ...(pronouns ? { pronounPresetId: pronouns.id } : {}) }
}

function parseNarratorIdentity(value: unknown): BattleNarratorIdentitySnapshot | null {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !['name', 'pronounPresetId'].includes(key)) ||
    !nonEmptyString(value.name) ||
    value.name.length > 48 ||
    /[<>\r\n\u0000-\u001f]/u.test(value.name)
  )
    return null
  const pronouns = PRONOUN_PRESETS.find((preset) => preset.id === value.pronounPresetId)
  if (Object.hasOwn(value, 'pronounPresetId') && !pronouns) return null
  return { name: value.name, ...(pronouns ? { pronounPresetId: pronouns.id } : {}) }
}

export interface BattleBuildAuthorityCombatantSnapshot {
  catalogueToken?: string
  skillEligibilityPolicyVersion?: 1
  sourceHash?: string
  narratorIdentity?: BattleNarratorIdentitySnapshot
  supportActionId?: SupportActionId
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
  narratorIdentity?: BattleNarratorIdentitySnapshot
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
    ...(value.relationshipOverrideDisciplineId !== undefined
      ? { relationshipOverrideDisciplineId: value.relationshipOverrideDisciplineId as string }
      : {}),
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
    ...(value.relationshipOverrideDisciplineId !== undefined
      ? { relationshipOverrideDisciplineId: value.relationshipOverrideDisciplineId as string }
      : {}),
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
    const reference = parseDisciplineSkillReference(candidate)
    if (!reference) return null
    parsed.push({ slotIndex: candidate.slotIndex, ...reference })
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
    ...(snapshot.skillEligibilityPolicyVersion === 1
      ? { skillEligibilityPolicyVersion: 1 as const }
      : {}),
    primary: { ...snapshot.primary },
    secondary: snapshot.secondary ? { ...snapshot.secondary } : null,
    disciplineSkills: [...snapshot.disciplineSkills]
      .sort((left, right) => left.slotIndex - right.slotIndex)
      .map((skill) => ({ ...skill })),
    ...(snapshot.supportActionId === undefined
      ? {}
      : { supportActionId: snapshot.supportActionId }),
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
      ...(snapshot.skillEligibilityPolicyVersion === 1
        ? { skillEligibilityPolicyVersion: 1 as const }
        : {}),
      primary: snapshot.primary,
      secondary: snapshot.secondary,
      disciplineSkills: snapshot.disciplineSkills,
      ...(snapshot.supportActionId === undefined
        ? {}
        : { supportActionId: snapshot.supportActionId }),
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

  const supportActionId = parseSupportActionId(value.supportActionId)
  if (Object.hasOwn(value, 'supportActionId') && !supportActionId) return null
  const narratorIdentity = Object.hasOwn(value, 'narratorIdentity')
    ? parseNarratorIdentity(value.narratorIdentity)
    : undefined
  if (narratorIdentity === null) return null
  if (
    Object.hasOwn(value, 'skillEligibilityPolicyVersion') &&
    value.skillEligibilityPolicyVersion !== 1
  )
    return null
  const combatSnapshot: CombatBuildSnapshot = {
    schemaVersion: COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION,
    sourceBuildSchemaVersion: value.buildSchemaVersion,
    sourceBuildVersion: value.buildVersion,
    ...(value.skillEligibilityPolicyVersion === 1
      ? { skillEligibilityPolicyVersion: 1 as const }
      : {}),
    fingerprint: value.fingerprint,
    primary: {
      disciplineId: value.primary.disciplineId,
      definitionVersion: value.primary.definitionVersion,
      profileVersion: value.primary.profileVersion,
    },
    secondary,
    disciplineSkills,
    ...(supportActionId ? { supportActionId } : {}),
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
  if (!allowPublishedSkillVersions) {
    const expectedResonance = resolveResonanceForPair(
      value.primary.disciplineId,
      secondaryDisciplineId,
      allowPublishedSkillVersions ? undefined : resonance?.contentVersion,
    )
    if (resonance) {
      if (!expectedResonance) return null
      const expected = resonanceSnapshotReference(expectedResonance)
      if (
        expected.resonanceId !== resonance.resonanceId ||
        (!allowPublishedSkillVersions && expected.contentVersion !== resonance.contentVersion) ||
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
      allowPublishedSkillVersions ? undefined : essence?.contentVersion,
    )
    if (essence) {
      if (!expectedEssence) return null
      const expected = essenceSnapshotReference(expectedEssence)
      if (
        expected.essenceId !== essence.essenceId ||
        (!allowPublishedSkillVersions && expected.contentVersion !== essence.contentVersion) ||
        expected.sourceDisciplineId !== essence.sourceDisciplineId ||
        expected.skillId !== essence.skillId ||
        (!allowPublishedSkillVersions &&
          expected.skillContentVersion !== essence.skillContentVersion)
      ) {
        return null
      }
    } else if (
      !legacyIronfist &&
      resolveEssenceForBuild(value.primary.disciplineId, secondaryDisciplineId)
    ) {
      return null
    }
  }

  return {
    combatantId: value.combatantId,
    ...(typeof value.catalogueToken === 'string' ? { catalogueToken: value.catalogueToken } : {}),
    ...(value.skillEligibilityPolicyVersion === 1
      ? { skillEligibilityPolicyVersion: 1 as const }
      : {}),
    ...(typeof value.sourceHash === 'string' ? { sourceHash: value.sourceHash } : {}),
    ...(narratorIdentity ? { narratorIdentity } : {}),
    characterId: value.characterId,
    snapshotSchemaVersion: COMBAT_BUILD_SNAPSHOT_SCHEMA_VERSION,
    buildSchemaVersion: value.buildSchemaVersion,
    buildVersion: value.buildVersion,
    fingerprint: value.fingerprint,
    primary: combatSnapshot.primary,
    secondary,
    disciplineSkills,
    ...(supportActionId ? { supportActionId } : {}),
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
    combatants: inputs.map(({ combatantId, characterId, snapshot, narratorIdentity }) => {
      const combatSnapshot = combatSnapshotFromCommitted(snapshot)
      return {
        combatantId,
        ...(snapshot.catalogueToken ? { catalogueToken: snapshot.catalogueToken } : {}),
        ...(snapshot.skillEligibilityPolicyVersion === 1
          ? { skillEligibilityPolicyVersion: 1 as const }
          : {}),
        ...(snapshot.sourceHash ? { sourceHash: snapshot.sourceHash } : {}),
        ...(narratorIdentity ? { narratorIdentity: { ...narratorIdentity } } : {}),
        characterId,
        snapshotSchemaVersion: combatSnapshot.schemaVersion,
        buildSchemaVersion: combatSnapshot.sourceBuildSchemaVersion,
        buildVersion: combatSnapshot.sourceBuildVersion,
        fingerprint: fingerprintCombatSnapshot(combatSnapshot),
        primary: { ...combatSnapshot.primary },
        secondary: combatSnapshot.secondary ? { ...combatSnapshot.secondary } : null,
        disciplineSkills: combatSnapshot.disciplineSkills.map((skill) => ({ ...skill })),
        ...(combatSnapshot.supportActionId === undefined
          ? {}
          : { supportActionId: combatSnapshot.supportActionId }),
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
  const skillIds = [
    ...new Set(
      inputs.flatMap((input) => input.snapshot.disciplineSkills.map((skill) => skill.skillId)),
    ),
  ]
  const currentDefinitions =
    resolver.resolveCurrentSkillDefinitions && skillIds.length > 0
      ? await resolver.resolveCurrentSkillDefinitions(skillIds)
      : undefined

  const resolvedInputs = await Promise.all(
    inputs.map(async (input): Promise<BattleBuildAuthorityInput> => {
      const disciplineSkills: CharacterCommittedBuildSnapshotRecord['disciplineSkills'][number][] =
        []
      for (const skill of input.snapshot.disciplineSkills) {
        const definition = currentDefinitions
          ? currentDefinitions.get(skill.skillId)
          : await resolver.resolveCurrentSkillDefinition(skill.skillId)
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

      const primary = input.snapshot.primary.disciplineId
      const secondary = input.snapshot.secondary?.disciplineId ?? null
      const builtinEssence = resolveEssenceForBuild(primary, secondary)
      const builtinResonance = resolveResonanceForPair(primary, secondary)
      const [currentEssence, currentResonance] = await Promise.all([
        resolver.resolveCurrentEssenceDefinition
          ? resolver.resolveCurrentEssenceDefinition(primary, secondary)
          : builtinEssence,
        resolver.resolveCurrentResonanceDefinition
          ? resolver.resolveCurrentResonanceDefinition(primary, secondary)
          : builtinResonance,
      ])
      if (
        currentEssence &&
        (!currentEssence.enabled ||
          !currentEssence.skill.enabled ||
          validateEssenceDefinition(currentEssence).length ||
          (!currentEssence.relationshipOverrideDisciplineId &&
            (currentEssence.sourceDisciplineId !== primary || secondary !== null)))
      )
        throw new TypeError(
          'Published Essence does not match the enabled committed build extension.',
        )
      if (
        currentResonance &&
        (!currentResonance.enabled ||
          validateResonanceDefinition(currentResonance).length ||
          (!currentResonance.relationshipOverrideDisciplineId &&
            (secondary === null ||
              !currentResonance.disciplinePair.includes(primary) ||
              !currentResonance.disciplinePair.includes(secondary))))
      )
        throw new TypeError('Published Resonance does not match the enabled committed build pair.')

      return {
        ...input,
        snapshot: {
          ...input.snapshot,
          disciplineSkills,
          extensions: {
            ...input.snapshot.extensions,
            essence: currentEssence ? essenceSnapshotReference(currentEssence) : null,
            resonance: currentResonance ? resonanceSnapshotReference(currentResonance) : null,
          },
        },
      }
    }),
  )

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

  const references = [...build.disciplineSkills].sort(
    (left, right) => left.slotIndex - right.slotIndex,
  )
  const definitions = await Promise.all(
    references.map((reference) =>
      resolvePinnedBattleSkillDefinition(
        authority,
        reference.skillId,
        reference.contentVersion,
        resolver,
      ),
    ),
  )
  if (
    definitions.some(
      (definition, index) =>
        !definition || definition.sourceDisciplineId !== references[index]!.sourceDisciplineId,
    )
  )
    return null
  // The validated pool is bounded by the committed build; Promise.all retains slot order.
  return definitions as MatureSkillDefinition[]
}

export function resolveBattleEssenceDefinition(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  combatantId: string,
): EssenceDefinition | null {
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  const reference = build?.extensions.essence
  if (!build || !reference) return null
  const definition = resolveEssenceForBuild(
    reference.sourceDisciplineId,
    null,
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
): AnyResonanceDefinition | null {
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  const reference = build?.extensions.resonance
  if (!build || !reference) return null
  const definition = resolveResonanceForPair(
    reference.disciplinePair[0],
    reference.disciplinePair[1],
    reference.contentVersion,
  )
  if (!definition) return null
  const expected = resonanceSnapshotReference(definition)
  return expected.resonanceId === reference.resonanceId ? definition : null
}

/** Published extensions are admitted by exact immutable reference and actual build ownership. */
export async function resolvePinnedBattleEssenceDefinition(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  combatantId: string,
  resolver?: CombatContentResolver,
): Promise<EssenceDefinition | null> {
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  const reference = build?.extensions.essence
  if (!build || !reference) return null
  const definition =
    authority?.catalogVersion === 3 && resolver?.resolvePinnedEssenceDefinition
      ? await resolver.resolvePinnedEssenceDefinition(
          reference.sourceDisciplineId,
          null,
          reference.essenceId,
          reference.contentVersion,
        )
      : resolveBattleEssenceDefinition(authority, combatantId)
  if (
    !definition ||
    validateEssenceDefinition(definition).length ||
    (build.secondary !== null && !reference.relationshipOverrideDisciplineId)
  )
    return null
  const expected = essenceSnapshotReference(definition)
  return expected.essenceId === reference.essenceId &&
    expected.contentVersion === reference.contentVersion &&
    (expected.sourceDisciplineId === build.primary.disciplineId ||
      reference.relationshipOverrideDisciplineId === expected.sourceDisciplineId) &&
    expected.sourceDisciplineId === reference.sourceDisciplineId &&
    expected.skillId === reference.skillId &&
    expected.skillContentVersion === reference.skillContentVersion
    ? {
        ...structuredClone(definition),
        ...(reference.relationshipOverrideDisciplineId
          ? { relationshipOverrideDisciplineId: reference.relationshipOverrideDisciplineId }
          : {}),
      }
    : null
}

export async function resolvePinnedBattleResonanceDefinition(
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  combatantId: string,
  resolver?: CombatContentResolver,
): Promise<AnyResonanceDefinition | null> {
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  const reference = build?.extensions.resonance
  if (!build || !reference || (!build.secondary && !reference.relationshipOverrideDisciplineId))
    return null
  const definition =
    authority?.catalogVersion === 3 && resolver?.resolvePinnedResonanceDefinition
      ? await resolver.resolvePinnedResonanceDefinition(
          reference.disciplinePair[0],
          reference.disciplinePair[1],
          reference.resonanceId,
          reference.contentVersion,
        )
      : resolveBattleResonanceDefinition(authority, combatantId)
  if (!definition || validateResonanceDefinition(definition).length) return null
  const expected = resonanceSnapshotReference(definition)
  return expected.resonanceId === reference.resonanceId &&
    expected.contentVersion === reference.contentVersion &&
    expected.disciplinePair[0] === reference.disciplinePair[0] &&
    expected.disciplinePair[1] === reference.disciplinePair[1]
    ? structuredClone(definition)
    : null
}

/** Server producer: captures every admitted canonical behavior, including unselected modes. */
export async function captureBattleBuildAbilitySources(
  state: CombatEncounterState,
  authority: BattleBuildAuthoritySnapshot,
  resolver?: CombatContentResolver,
  practiceGuard = false,
): Promise<readonly CapturedCombatAbilitySource[]> {
  const ids = new Set<BasicSkillId>(['basic.move', 'unarmed.basic'])
  for (const build of authority.combatants) ids.add(build.supportActionId ?? 'basic.guard')
  if (practiceGuard) ids.add('basic.guard')
  // One current Basic read for the entire admission, shared by both PvP owners.
  // No resolver capability means historical admission keeps its native Basics.
  const basics = resolver?.resolveCurrentBasicSkillDefinitions?.([...ids]) ?? Promise.resolve(null)
  const captured = await Promise.all(
    authority.combatants.map(async (build) => {
      const sources: CapturedCombatAbilitySource[] = []
      // Independent immutable reads share one bounded wave rather than adding
      // per-Skill/owner round trips to the map and standard PvP entry paths.
      const [regular, essence, resonance, definitions] = await Promise.all([
        resolveBattleDisciplineSkillDefinitions(authority, build.combatantId, resolver),
        resolvePinnedBattleEssenceDefinition(authority, build.combatantId, resolver),
        resolvePinnedBattleResonanceDefinition(authority, build.combatantId, resolver),
        basics,
      ])
      if (definitions) {
        const support = build.supportActionId ?? 'basic.guard'
        const selected = captureBasicSkillSources({
          ownerCombatantId: build.combatantId,
          supportActionId: support,
          definitions: [...definitions.values()],
        })
        sources.push(...selected)
        if (practiceGuard && support !== 'basic.guard') {
          // Existing Guided Fundamentals Guard control is an exercise action, not a new equipped slot.
          const guard = captureBasicSkillSources({
            ownerCombatantId: build.combatantId,
            supportActionId: 'basic.guard',
            definitions: [...definitions.values()],
          })[2]!
          sources.push(guard)
        }
      }
      if (!regular) throw new TypeError('Pinned battle Skill definition is unavailable.')
      for (const definition of regular) {
        const source = capturedMatureSkillAbilitySource(state, definition, build.combatantId)
        if (source) sources.push(source)
        else if (!definition.enabled) throw new TypeError('Pinned battle Skill is disabled.')
      }
      if (build.extensions.essence && !essence)
        throw new TypeError('Pinned battle Essence definition is unavailable.')
      if (essence) {
        const source = capturedMatureSkillAbilitySource(
          state,
          essenceCombatSkill(essence),
          build.combatantId,
        )
        if (source) sources.push(source)
        if ((!essence.enabled || !essence.skill.enabled) && !source)
          throw new TypeError('Pinned battle Essence is disabled.')
      }
      if (build.extensions.resonance && !resonance)
        throw new TypeError('Pinned battle Resonance definition is unavailable.')
      if (resonance) {
        const source = capturedResonanceAbilitySource(
          state,
          build.combatantId,
          resonance,
          build.extensions.resonance!.disciplinePair,
        )
        if (source) sources.push(source)
        else if (!resonance.enabled) throw new TypeError('Pinned battle Resonance is disabled.')
      }
      return sources
    }),
  )
  return captured.flat()
}

/** Client action IDs are admitted against the captured build, never the current catalogue. */
export function capturedBattleActionSource(
  state: CombatEncounterState,
  authority: BattleBuildAuthoritySnapshot | null | undefined,
  combatantId: string,
  actionId: string,
): CapturedCombatAbilitySource | null {
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  if (!build) return null
  const regular = build.disciplineSkills.find((row) => row.skillId === actionId)
  const essence = build.extensions.essence?.skillId === actionId ? build.extensions.essence : null
  const resonance =
    build.extensions.resonance?.resonanceId === actionId ? build.extensions.resonance : null
  const expectedKind = regular
    ? 'discipline-skill'
    : essence
      ? 'essence'
      : resonance
        ? 'resonance'
        : null
  const version =
    regular?.contentVersion ?? essence?.skillContentVersion ?? resonance?.contentVersion
  if (!expectedKind) return null
  const source = state.capturedAbilitySources?.find(
    (row) =>
      row.ownerCombatantId === combatantId &&
      row.abilityId === actionId &&
      row.sourceKind === expectedKind,
  )
  if (!source) return null
  if (
    source.contentVersion !== version ||
    (regular && source.sourceDisciplineId !== regular.sourceDisciplineId) ||
    (essence && source.sourceDisciplineId !== essence.sourceDisciplineId) ||
    (resonance &&
      source.sourceInstanceId !==
        JSON.stringify(['resonance', combatantId, ...resonance.disciplinePair, actionId, version]))
  )
    throw new TypeError('Captured battle source does not match its exact build reference.')
  return source
}
