import 'server-only'

import { createHash } from 'node:crypto'
import type { CombatContentResolver } from '../combat/combat-content-resolver'
import { isDisciplineSkillIdentity } from './discipline-skill-reference-parser'

import { projectAllocationForPrimaryDisciplineChange } from '@aurevane/game-core/character/attribute-allocation'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import {
  buildPrimaryDisciplinePreview,
  disciplineAttributePolicyForProfile,
  type DisciplineDefinition,
  type PrimaryDisciplineBaseProfile,
  type PrimaryDisciplinePreview,
} from '@aurevane/game-core/character/discipline-build'
import {
  disciplineSkillCapacity,
  disciplineSkillEligibilityId,
  validateDisciplineSkillLoadout,
  type DisciplineSkillReference,
} from '@aurevane/game-core/character/discipline-skill-loadout'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
  type EssenceDefinition,
  type EssenceSnapshotReference,
} from '@aurevane/game-core/combat/essence'
import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  resonanceSnapshotReference,
  resolveResonanceForPair,
  type AnyResonanceDefinition,
  type ResonanceSnapshotReference,
} from '@aurevane/game-core/combat/resonance'
import {
  parseSupportActionId,
  type SupportActionId,
} from '@aurevane/game-core/combat/support-actions'
import { AurevaneError } from '@aurevane/game-core/errors'

export interface CharacterAttunementPolicy {
  version: number
  primaryCooldownSeconds: number
  secondaryCooldownSeconds: number
}

export interface CharacterActiveBuildRecord {
  supportActionId?: SupportActionId
  characterId: string
  schemaVersion: number
  buildVersion: number
  primaryDefinition: DisciplineDefinition
  primaryProfile: PrimaryDisciplineBaseProfile
  secondaryDefinition: DisciplineDefinition | null
  primaryAttunementLockedUntil: string | null
  secondaryAttunementLockedUntil: string | null
  attunementPolicy: CharacterAttunementPolicy
  serverNow: string
  updatedAt: string
}

export interface DisciplineCatalogEntry {
  definition: DisciplineDefinition
  profile: PrimaryDisciplineBaseProfile
  masteredAt: string | null
}

export type PrimaryDisciplineCatalogEntry = DisciplineCatalogEntry
export type SecondaryDisciplineCatalogEntry = DisciplineCatalogEntry & { masteredAt: string }

export interface CharacterLearnedSkillRecord extends DisciplineSkillReference {
  learnedAt: string
  /** Absent only in historical/in-memory adapters; actual joined reads always supply provenance. */
  grantedAt?: string
  grantSourceKind?: 'system' | 'gameplay' | 'support' | 'owner' | 'migration'
  grantSourceId?: string
  earnedAt?: string | null
  earnedSourceKind?: 'system' | 'gameplay' | 'support' | 'owner' | 'migration' | null
  earnedSourceId?: string | null
}

export interface CharacterEquippedDisciplineSkillRecord extends DisciplineSkillReference {
  slotIndex: number
  equippedAt: string
}

export interface CharacterCommittedBuildSnapshotRecord {
  /** Server-only exact source facts, never a public profile field. */
  catalogueToken?: string
  skillEligibilityPolicyVersion?: 1
  sourceHash?: string
  supportActionId?: SupportActionId
  schemaVersion: number
  buildVersion: number
  primary: {
    disciplineId: string
    definitionVersion: number
    profileVersion: number
  }
  secondary: {
    disciplineId: string
    definitionVersion: number
  } | null
  disciplineSkills: readonly (DisciplineSkillReference & { slotIndex: number })[]
  extensions: {
    resonance: ResonanceSnapshotReference | null
    essence: EssenceSnapshotReference | null
    equipmentSkills: readonly never[]
    supernatural: null
    prestige: null
  }
}

export interface ChangeDisciplinesInput {
  userId: string
  characterId: string
  expectedBuildVersion: number
  changePrimary: boolean
  primaryDisciplineId: string
  changeSecondary: boolean
  secondaryDisciplineId: string | null
  idempotencyKey: string
  requestFingerprint: string
}

export interface SaveDisciplineSkillsInput {
  userId: string
  characterId: string
  expectedBuildVersion: number
  skills: readonly DisciplineSkillReference[]
  idempotencyKey: string
  requestFingerprint: string
}

export interface SaveSupportActionInput {
  userId: string
  characterId: string
  expectedBuildVersion: number
  supportActionId: SupportActionId
  idempotencyKey: string
  requestFingerprint: string
}

export interface CharacterBuildRepository {
  /** Actual Supabase adapters supply the shared published/current and exact-pin authority. */
  contentResolver?: CombatContentResolver
  saveSupportAction(
    input: SaveSupportActionInput,
  ): Promise<{ buildVersion: number; replayed: boolean }>
  findActiveBuild(userId: string, characterId: string): Promise<CharacterActiveBuildRecord | null>
  listDisciplines(userId: string, characterId: string): Promise<readonly DisciplineCatalogEntry[]>
  listLearnedSkills(
    userId: string,
    characterId: string,
  ): Promise<readonly CharacterLearnedSkillRecord[]>
  listEquippedDisciplineSkills(
    userId: string,
    characterId: string,
  ): Promise<readonly CharacterEquippedDisciplineSkillRecord[]>
  loadCommittedBuildSnapshot(
    userId: string,
    characterId: string,
  ): Promise<CharacterCommittedBuildSnapshotRecord | null>
  changeDisciplines(
    input: ChangeDisciplinesInput,
  ): Promise<{ build: CharacterActiveBuildRecord; replayed: boolean }>
  saveDisciplineSkills(
    input: SaveDisciplineSkillsInput,
  ): Promise<{ buildVersion: number; replayed: boolean }>
}

export interface CharacterAttunementView {
  policy: CharacterAttunementPolicy
  serverNow: string
  primaryLockedUntil: string | null
  secondaryLockedUntil: string | null
  primaryRemainingSeconds: number
  secondaryRemainingSeconds: number
}

export interface CharacterSkillCatalogEntry {
  definition: MatureSkillDefinition
  learnedAt: string
  activeSource: boolean
  eligibilityGrants?: readonly {
    eligibilityDisciplineId: string
    activeSource: boolean
    grantedAt?: string
    earnedAt?: string | null
    grantSourceKind?: CharacterLearnedSkillRecord['grantSourceKind']
  }[]
}

export interface CharacterEquippedDisciplineSkill {
  eligibilityDisciplineId?: string
  definition: MatureSkillDefinition
  slotIndex: number
  equippedAt: string
}

export interface CharacterDisciplineSkillLoadoutView {
  capacity: number
  learnedSkills: readonly CharacterSkillCatalogEntry[]
  equippedSkills: readonly CharacterEquippedDisciplineSkill[]
  extensions: {
    resonance: AnyResonanceDefinition | null
    essence: EssenceDefinition | null
    equipmentSkills: readonly never[]
    supernatural: null
    prestige: null
  }
}

export interface CharacterBuildContext {
  build: CharacterActiveBuildRecord
  current: PrimaryDisciplinePreview
  currentSecondary: DisciplineDefinition | null
  availablePrimaries: readonly PrimaryDisciplineCatalogEntry[]
  availableSecondaries: readonly SecondaryDisciplineCatalogEntry[]
  attunement: CharacterAttunementView
  disciplineSkills: CharacterDisciplineSkillLoadoutView
}

export interface CharacterBuildPreview {
  current: PrimaryDisciplinePreview
  currentSecondary: DisciplineDefinition | null
  proposed: PrimaryDisciplinePreview
  proposedSecondary: DisciplineDefinition | null
  buildVersion: number
  changes: {
    primary: boolean
    secondary: boolean
  }
  attunement: CharacterAttunementView
}

export interface DisciplineChangeResult extends CharacterBuildContext {
  replayed: boolean
}

export interface DisciplineSkillSaveResult extends CharacterBuildContext {
  replayed: boolean
}

export interface BuildSelectionInput {
  primaryDisciplineId?: string
  secondaryDisciplineId?: string | null
}

function calculatePreview(
  character: PersistedCharacter,
  entry: PrimaryDisciplineCatalogEntry,
  attributes: PersistedCharacter['attributes'] = character.attributes,
): PrimaryDisciplinePreview {
  return buildPrimaryDisciplinePreview({
    attributes,
    level: character.level,
    primaryDefinition: entry.definition,
    primaryProfile: entry.profile,
  })
}

function secondsRemaining(lockedUntil: string | null, serverNow: string): number {
  if (!lockedUntil) return 0
  const lockedMs = Date.parse(lockedUntil)
  const serverMs = Date.parse(serverNow)
  if (!Number.isFinite(lockedMs) || !Number.isFinite(serverMs)) return 0
  return Math.max(0, Math.ceil((lockedMs - serverMs) / 1000))
}

function buildAttunementView(build: CharacterActiveBuildRecord): CharacterAttunementView {
  return {
    policy: build.attunementPolicy,
    serverNow: build.serverNow,
    primaryLockedUntil: build.primaryAttunementLockedUntil,
    secondaryLockedUntil: build.secondaryAttunementLockedUntil,
    primaryRemainingSeconds: secondsRemaining(build.primaryAttunementLockedUntil, build.serverNow),
    secondaryRemainingSeconds: secondsRemaining(
      build.secondaryAttunementLockedUntil,
      build.serverNow,
    ),
  }
}

function availableCatalog(catalog: readonly DisciplineCatalogEntry[]) {
  const availablePrimaries = catalog.filter(
    (entry): entry is PrimaryDisciplineCatalogEntry => entry.definition.enabledForPrimary,
  )
  const availableSecondaries = catalog.filter(
    (entry): entry is SecondaryDisciplineCatalogEntry =>
      entry.definition.enabledForSecondary && entry.masteredAt !== null,
  )
  return { availablePrimaries, availableSecondaries }
}

function selectedPrimary(
  id: string,
  availablePrimaries: readonly PrimaryDisciplineCatalogEntry[],
): PrimaryDisciplineCatalogEntry {
  const entry = availablePrimaries.find((candidate) => candidate.definition.id === id)
  if (!entry) {
    throw new AurevaneError('INVALID_REQUEST', 'That Primary Discipline is not available.')
  }
  return entry
}

function selectedSecondary(
  id: string,
  availableSecondaries: readonly SecondaryDisciplineCatalogEntry[],
): SecondaryDisciplineCatalogEntry {
  const entry = availableSecondaries.find((candidate) => candidate.definition.id === id)
  if (!entry) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'That Secondary Discipline is unavailable or has not been mastered.',
    )
  }
  return entry
}

function resolvedPrimaryEntry(
  id: string,
  context: CharacterBuildContext,
  refreshCurrent = false,
): PrimaryDisciplineCatalogEntry {
  if (id === context.current.definition.id && !refreshCurrent) {
    return {
      definition: context.current.definition,
      profile: context.current.profile,
      masteredAt: null,
    }
  }
  return selectedPrimary(id, context.availablePrimaries)
}

function resolvedSecondaryDefinition(
  id: string | null,
  context: CharacterBuildContext,
): DisciplineDefinition | null {
  if (id === null) return null
  if (id === context.currentSecondary?.id) return context.currentSecondary
  return selectedSecondary(id, context.availableSecondaries).definition
}

async function buildDisciplineSkillView(
  build: CharacterActiveBuildRecord,
  learnedRecords: readonly CharacterLearnedSkillRecord[],
  equippedRecords: readonly CharacterEquippedDisciplineSkillRecord[],
  contentResolver?: CombatContentResolver,
): Promise<CharacterDisciplineSkillLoadoutView> {
  const secondaryDisciplineId = build.secondaryDefinition?.id ?? null
  const activeSources = new Set([
    build.primaryDefinition.id,
    ...(secondaryDisciplineId ? [secondaryDisciplineId] : []),
  ])
  // Validate persisted pins/grants before replacing only display bodies with current content.
  const issues = validateDisciplineSkillLoadout({
    primaryDisciplineId: build.primaryDefinition.id,
    secondaryDisciplineId,
    equipped: equippedRecords,
    learned: learnedRecords,
  })
  if (issues.length > 0)
    throw persistenceUnavailable(`The committed Skill loadout is illegal: ${issues[0]?.message}`)
  const resolver = contentResolver?.captureCurrentCatalogue
    ? (await contentResolver.captureCurrentCatalogue()).resolver
    : contentResolver
  const ids = [...new Set([...learnedRecords, ...equippedRecords].map((record) => record.skillId))]
  const definitions = resolver?.resolveCurrentSkillDefinitions
    ? await resolver.resolveCurrentSkillDefinitions(ids)
    : new Map(
        await Promise.all(
          ids.map(
            async (id) =>
              [
                id,
                resolver
                  ? await resolver.resolveCurrentSkillDefinition(id)
                  : resolveMatureSkillVersion(id),
              ] as const,
          ),
        ),
      )
  function definitionFor(record: DisciplineSkillReference) {
    const definition = definitions.get(record.skillId)
    if (
      !definition ||
      definition.id !== record.skillId ||
      definition.sourceDisciplineId !== record.sourceDisciplineId
    ) {
      throw persistenceUnavailable(
        'A learned Skill references a missing or invalid current definition.',
      )
    }
    return definition
  }
  const learnedById = new Map<string, CharacterSkillCatalogEntry>()
  for (const record of learnedRecords) {
    const eligibilityDisciplineId = disciplineSkillEligibilityId(record)
    if (!eligibilityDisciplineId)
      throw persistenceUnavailable('A learned Skill has invalid eligibility.')
    const activeSource = activeSources.has(eligibilityDisciplineId)
    const previous = learnedById.get(record.skillId)
    learnedById.set(record.skillId, {
      definition: definitionFor(record),
      learnedAt: record.learnedAt,
      activeSource: activeSource || (previous?.activeSource ?? false),
      eligibilityGrants: [
        ...(previous?.eligibilityGrants ?? []),
        {
          eligibilityDisciplineId,
          activeSource,
          grantedAt: record.grantedAt,
          earnedAt: record.earnedAt,
          grantSourceKind: record.grantSourceKind,
        },
      ],
    })
  }
  const [resonance, essence] = await Promise.all([
    resolver?.resolveCurrentResonanceDefinition
      ? resolver.resolveCurrentResonanceDefinition(
          build.primaryDefinition.id,
          secondaryDisciplineId,
        )
      : resolveResonanceForPair(build.primaryDefinition.id, secondaryDisciplineId),
    resolver?.resolveCurrentEssenceDefinition
      ? resolver.resolveCurrentEssenceDefinition(build.primaryDefinition.id, secondaryDisciplineId)
      : resolveEssenceForBuild(build.primaryDefinition.id, secondaryDisciplineId),
  ])
  return {
    capacity: disciplineSkillCapacity(secondaryDisciplineId),
    learnedSkills: [...learnedById.values()],
    equippedSkills: equippedRecords.map((record) => ({
      definition: definitionFor(record),
      slotIndex: record.slotIndex,
      equippedAt: record.equippedAt,
      ...(Object.hasOwn(record, 'eligibilityDisciplineId')
        ? { eligibilityDisciplineId: record.eligibilityDisciplineId }
        : {}),
    })),
    extensions: { resonance, essence, equipmentSkills: [], supernatural: null, prestige: null },
  }
}

export async function loadCharacterBuildContext(
  userId: string,
  character: PersistedCharacter,
  repository: CharacterBuildRepository,
): Promise<CharacterBuildContext> {
  const [build, catalog, learnedSkills, equippedSkills] = await Promise.all([
    repository.findActiveBuild(userId, character.id),
    repository.listDisciplines(userId, character.id),
    repository.listLearnedSkills(userId, character.id),
    repository.listEquippedDisciplineSkills(userId, character.id),
  ])
  if (!build) {
    throw persistenceUnavailable('The character build is unavailable right now.')
  }
  const { availablePrimaries, availableSecondaries } = availableCatalog(catalog)
  return {
    build,
    current: calculatePreview(character, {
      definition: build.primaryDefinition,
      profile: build.primaryProfile,
      masteredAt:
        catalog.find((entry) => entry.definition.id === build.primaryDefinition.id)?.masteredAt ??
        null,
    }),
    currentSecondary: build.secondaryDefinition,
    availablePrimaries,
    availableSecondaries,
    attunement: buildAttunementView(build),
    disciplineSkills: await buildDisciplineSkillView(
      build,
      learnedSkills,
      equippedSkills,
      repository.contentResolver,
    ),
  }
}

export async function loadCharacterCommittedBuildSnapshot(
  userId: string,
  characterId: string,
  repository: CharacterBuildRepository,
): Promise<CharacterCommittedBuildSnapshotRecord> {
  const snapshot = await repository.loadCommittedBuildSnapshot(userId, characterId)
  if (!snapshot) throw persistenceUnavailable('The committed build snapshot is unavailable.')

  if (snapshot.supportActionId !== undefined && !parseSupportActionId(snapshot.supportActionId)) {
    throw persistenceUnavailable('The committed build snapshot contains an invalid Support Action.')
  }
  const secondaryDisciplineId = snapshot.secondary?.disciplineId ?? null
  const activeSources = new Set(
    snapshot.secondary
      ? [snapshot.primary.disciplineId, snapshot.secondary.disciplineId]
      : [snapshot.primary.disciplineId],
  )
  for (const skill of snapshot.disciplineSkills) {
    const definition = repository.contentResolver
      ? await repository.contentResolver.resolvePinnedSkillDefinition(
          skill.skillId,
          skill.contentVersion,
        )
      : resolveMatureSkillVersion(skill.skillId, skill.contentVersion)
    if (
      !definition ||
      definition.sourceDisciplineId !== skill.sourceDisciplineId ||
      !activeSources.has(disciplineSkillEligibilityId(skill) ?? '')
    ) {
      throw persistenceUnavailable('The committed build snapshot contains an invalid Skill.')
    }
  }
  if (
    validateDisciplineSkillLoadout({
      primaryDisciplineId: snapshot.primary.disciplineId,
      secondaryDisciplineId,
      equipped: snapshot.disciplineSkills,
      learned: snapshot.disciplineSkills,
    }).length > 0
  ) {
    throw persistenceUnavailable('The committed build snapshot exceeds Skill capacity.')
  }

  const persistedResonance = snapshot.extensions.resonance
  const latestResonance = resolveResonanceForPair(
    snapshot.primary.disciplineId,
    secondaryDisciplineId,
  )
  if (!persistedResonance) {
    if (!repository.contentResolver && latestResonance) {
      throw persistenceUnavailable('The committed build snapshot is missing its Resonance.')
    }
  } else {
    const resolved = repository.contentResolver?.resolvePinnedResonanceDefinition
      ? await repository.contentResolver.resolvePinnedResonanceDefinition(
          snapshot.primary.disciplineId,
          secondaryDisciplineId,
          persistedResonance.resonanceId,
          persistedResonance.contentVersion,
        )
      : resolveResonanceForPair(
          snapshot.primary.disciplineId,
          secondaryDisciplineId,
          persistedResonance.contentVersion,
        )
    if (!resolved) {
      throw persistenceUnavailable('The committed build snapshot contains an invalid Resonance.')
    }
    const expected = resonanceSnapshotReference(resolved)
    if (
      expected.resonanceId !== persistedResonance.resonanceId ||
      expected.contentVersion !== persistedResonance.contentVersion ||
      expected.disciplinePair[0] !== persistedResonance.disciplinePair[0] ||
      expected.disciplinePair[1] !== persistedResonance.disciplinePair[1]
    ) {
      throw persistenceUnavailable('The committed build snapshot contains an invalid Resonance.')
    }
  }

  const persistedEssence = snapshot.extensions.essence
  const latestEssence = resolveEssenceForBuild(snapshot.primary.disciplineId, secondaryDisciplineId)
  if (!persistedEssence) {
    if (!repository.contentResolver && latestEssence) {
      throw persistenceUnavailable('The committed build snapshot is missing its Essence.')
    }
  } else {
    const resolved = repository.contentResolver?.resolvePinnedEssenceDefinition
      ? await repository.contentResolver.resolvePinnedEssenceDefinition(
          snapshot.primary.disciplineId,
          secondaryDisciplineId,
          persistedEssence.essenceId,
          persistedEssence.contentVersion,
        )
      : resolveEssenceForBuild(
          snapshot.primary.disciplineId,
          secondaryDisciplineId,
          persistedEssence.contentVersion,
        )
    if (!resolved) {
      throw persistenceUnavailable('The committed build snapshot contains an invalid Essence.')
    }
    const expected = essenceSnapshotReference(resolved)
    if (
      expected.essenceId !== persistedEssence.essenceId ||
      expected.contentVersion !== persistedEssence.contentVersion ||
      expected.sourceDisciplineId !== persistedEssence.sourceDisciplineId ||
      expected.skillId !== persistedEssence.skillId ||
      expected.skillContentVersion !== persistedEssence.skillContentVersion
    ) {
      throw persistenceUnavailable('The committed build snapshot contains an invalid Essence.')
    }
  }

  return snapshot
}

export async function previewCharacterDisciplines(
  userId: string,
  character: PersistedCharacter,
  input: BuildSelectionInput,
  repository: CharacterBuildRepository,
): Promise<CharacterBuildPreview> {
  const context = await loadCharacterBuildContext(userId, character, repository)
  const primaryId =
    input.primaryDisciplineId === undefined
      ? context.current.definition.id
      : input.primaryDisciplineId.trim()
  if (!primaryId) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose a Primary Discipline to preview.')
  }

  const hasSecondaryInput = Object.prototype.hasOwnProperty.call(input, 'secondaryDisciplineId')
  const secondaryId = hasSecondaryInput
    ? input.secondaryDisciplineId === null
      ? null
      : (input.secondaryDisciplineId ?? '').trim()
    : (context.currentSecondary?.id ?? null)

  if (hasSecondaryInput && input.secondaryDisciplineId !== null && !secondaryId) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose a valid Secondary Discipline to preview.')
  }

  const primary = resolvedPrimaryEntry(primaryId, context, input.primaryDisciplineId !== undefined)
  const secondary = resolvedSecondaryDefinition(secondaryId, context)

  if (secondary?.id === primary.definition.id) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Primary and Secondary Discipline must be different.',
    )
  }

  const changesPrimary =
    primary.definition.id !== context.current.definition.id ||
    primary.definition.definitionVersion !== context.current.definition.definitionVersion ||
    primary.profile.profileVersion !== context.current.profile.profileVersion
  let proposedAttributes = character.attributes
  if (changesPrimary) {
    const currentPolicy = disciplineAttributePolicyForProfile(context.current.profile)
    const proposedPolicy = disciplineAttributePolicyForProfile(primary.profile)
    if (!currentPolicy || !proposedPolicy) {
      throw new AurevaneError('INVALID_REQUEST', 'The selected Primary Discipline is unavailable.')
    }
    const projection = projectAllocationForPrimaryDisciplineChange({
      attributes: character.attributes,
      level: character.level,
      currentPolicy,
      proposedPolicy,
    })
    if (projection.issues.length > 0) {
      throw new AurevaneError(
        'INVALID_REQUEST',
        projection.issues[0]?.message ??
          'That Primary Discipline cannot use the current Core Stats.',
      )
    }
    proposedAttributes = projection.attributes
  }

  return {
    current: context.current,
    currentSecondary: context.currentSecondary,
    proposed: calculatePreview(character, primary, proposedAttributes),
    proposedSecondary: secondary,
    buildVersion: context.build.buildVersion,
    changes: {
      primary: changesPrimary,
      secondary: (secondary?.id ?? null) !== (context.currentSecondary?.id ?? null),
    },
    attunement: context.attunement,
  }
}

export async function previewCharacterPrimaryDiscipline(
  userId: string,
  character: PersistedCharacter,
  primaryDisciplineId: string,
  repository: CharacterBuildRepository,
): Promise<{
  current: PrimaryDisciplinePreview
  proposed: PrimaryDisciplinePreview
  buildVersion: number
}> {
  const preview = await previewCharacterDisciplines(
    userId,
    character,
    { primaryDisciplineId },
    repository,
  )
  return {
    current: preview.current,
    proposed: preview.proposed,
    buildVersion: preview.buildVersion,
  }
}

function validateCommitInput(input: { expectedBuildVersion: number; idempotencyKey: string }) {
  if (!Number.isInteger(input.expectedBuildVersion) || input.expectedBuildVersion < 1) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'The build version is invalid. Refresh and try again.',
    )
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.idempotencyKey,
    )
  ) {
    throw new AurevaneError('INVALID_REQUEST', 'The build request key is invalid.')
  }
}

export async function saveCharacterDisciplineSkills(
  userId: string,
  character: PersistedCharacter,
  input: {
    expectedBuildVersion: number
    skillIds: readonly string[]
    eligibilitySelections?: readonly { skillId: string; eligibilityDisciplineId: string }[]
    idempotencyKey: string
  },
  repository: CharacterBuildRepository,
): Promise<DisciplineSkillSaveResult> {
  validateCommitInput(input)
  if (
    !Array.isArray(input.skillIds) ||
    input.skillIds.some((skillId) => typeof skillId !== 'string')
  ) {
    throw new AurevaneError('INVALID_REQUEST', 'The Discipline Skill selection is invalid.')
  }

  const [context, learnedRecords] = await Promise.all([
    loadCharacterBuildContext(userId, character, repository),
    repository.listLearnedSkills(userId, character.id),
  ])
  const currentLearnedById = new Map(
    context.disciplineSkills.learnedSkills.map((entry) => [entry.definition.id, entry] as const),
  )
  const choices = new Map<string, string>()
  if (input.eligibilitySelections !== undefined) {
    if (!Array.isArray(input.eligibilitySelections))
      throw new AurevaneError('INVALID_REQUEST', 'The Skill eligibility selection is invalid.')
    for (const choice of input.eligibilitySelections) {
      if (
        !choice ||
        !isDisciplineSkillIdentity(choice.skillId) ||
        !isDisciplineSkillIdentity(choice.eligibilityDisciplineId) ||
        choices.has(choice.skillId) ||
        !input.skillIds.includes(choice.skillId)
      ) {
        throw new AurevaneError('INVALID_REQUEST', 'The Skill eligibility selection is invalid.')
      }
      choices.set(choice.skillId, choice.eligibilityDisciplineId)
    }
  }
  const active = new Set([context.current.definition.id, context.currentSecondary?.id])
  const selected = input.skillIds.map((candidate) => {
    const skillId = candidate.trim()
    const eligible = learnedRecords.filter(
      (record) =>
        record.skillId === skillId && active.has(disciplineSkillEligibilityId(record) ?? ''),
    )
    const chosen = choices.get(skillId)
    if (!chosen && eligible.length > 1)
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Choose the eligible Discipline for each shared Skill before saving.',
      )
    const record = chosen
      ? eligible.find((record) => disciplineSkillEligibilityId(record) === chosen)
      : eligible[0]
    if (!record || !currentLearnedById.get(skillId)?.definition.enabled)
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Only learned Skills eligible for an active Discipline may be equipped.',
      )
    return {
      skillId: record.skillId,
      contentVersion: record.contentVersion,
      sourceDisciplineId: record.sourceDisciplineId,
      ...(Object.hasOwn(record, 'eligibilityDisciplineId')
        ? { eligibilityDisciplineId: record.eligibilityDisciplineId }
        : {}),
    } satisfies DisciplineSkillReference
  })

  const issues = validateDisciplineSkillLoadout({
    primaryDisciplineId: context.current.definition.id,
    secondaryDisciplineId: context.currentSecondary?.id ?? null,
    equipped: selected,
    learned: learnedRecords,
  })
  if (issues.length > 0) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      issues[0]?.message ?? 'That Skill loadout is invalid.',
    )
  }

  const currentIds = context.disciplineSkills.equippedSkills.map((entry) => entry.definition.id)
  if (
    currentIds.length === selected.length &&
    currentIds.every(
      (skillId, index) =>
        skillId === selected[index]?.skillId &&
        (context.disciplineSkills.equippedSkills[index]?.eligibilityDisciplineId ??
          context.disciplineSkills.equippedSkills[index]?.definition.sourceDisciplineId) ===
          disciplineSkillEligibilityId(selected[index]!),
    )
  ) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'That Discipline Skill loadout is already committed.',
    )
  }

  const requestFingerprint = `sha256:${createHash('sha256')
    .update(
      JSON.stringify({
        command: 'character.discipline-skills.save.v1',
        characterId: character.id,
        expectedBuildVersion: input.expectedBuildVersion,
        skills: selected,
      }),
    )
    .digest('hex')}`

  const saved = await repository.saveDisciplineSkills({
    userId,
    characterId: character.id,
    expectedBuildVersion: input.expectedBuildVersion,
    skills: selected,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint,
  })
  const next = await loadCharacterBuildContext(userId, character, repository)
  return { ...next, replayed: saved.replayed }
}

export async function changeCharacterDisciplines(
  userId: string,
  character: PersistedCharacter,
  input: {
    expectedBuildVersion: number
    primaryDisciplineId?: string
    secondaryDisciplineId?: string | null
    idempotencyKey: string
  },
  repository: CharacterBuildRepository,
): Promise<DisciplineChangeResult> {
  validateCommitInput(input)
  const context = await loadCharacterBuildContext(userId, character, repository)

  const hasPrimaryInput = Object.prototype.hasOwnProperty.call(input, 'primaryDisciplineId')
  const hasSecondaryInput = Object.prototype.hasOwnProperty.call(input, 'secondaryDisciplineId')
  if (!hasPrimaryInput && !hasSecondaryInput) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose a Discipline change to commit.')
  }

  const primaryId = hasPrimaryInput
    ? (input.primaryDisciplineId ?? '').trim()
    : context.current.definition.id
  if (!primaryId) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose a Primary Discipline to commit.')
  }

  const secondaryId = hasSecondaryInput
    ? input.secondaryDisciplineId === null
      ? null
      : (input.secondaryDisciplineId ?? '').trim()
    : (context.currentSecondary?.id ?? null)
  if (hasSecondaryInput && input.secondaryDisciplineId !== null && !secondaryId) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose a valid Secondary Discipline to commit.')
  }

  const primary = resolvedPrimaryEntry(primaryId, context, input.primaryDisciplineId !== undefined)
  const secondary = resolvedSecondaryDefinition(secondaryId, context)

  if (secondary?.id === primary.definition.id) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Primary and Secondary Discipline must be different.',
    )
  }

  const changePrimary =
    primary.definition.id !== context.current.definition.id ||
    primary.definition.definitionVersion !== context.current.definition.definitionVersion ||
    primary.profile.profileVersion !== context.current.profile.profileVersion
  const changeSecondary = (secondary?.id ?? null) !== (context.currentSecondary?.id ?? null)

  if (!changePrimary && !changeSecondary) {
    throw new AurevaneError('INVALID_REQUEST', 'That Discipline build is already committed.')
  }

  const requestFingerprint = `sha256:${createHash('sha256')
    .update(
      JSON.stringify({
        command: 'character.disciplines.change.v2',
        characterId: character.id,
        expectedBuildVersion: input.expectedBuildVersion,
        changePrimary,
        primaryDisciplineId: primary.definition.id,
        changeSecondary,
        secondaryDisciplineId: secondary?.id ?? null,
      }),
    )
    .digest('hex')}`

  const changed = await repository.changeDisciplines({
    userId,
    characterId: character.id,
    expectedBuildVersion: input.expectedBuildVersion,
    changePrimary,
    primaryDisciplineId: primary.definition.id,
    changeSecondary,
    secondaryDisciplineId: secondary?.id ?? null,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint,
  })

  const next = await loadCharacterBuildContext(userId, character, repository)
  return { ...next, replayed: changed.replayed }
}

export async function changeCharacterPrimaryDiscipline(
  userId: string,
  character: PersistedCharacter,
  input: { expectedBuildVersion: number; primaryDisciplineId: string; idempotencyKey: string },
  repository: CharacterBuildRepository,
): Promise<DisciplineChangeResult> {
  return changeCharacterDisciplines(userId, character, input, repository)
}

function persistenceUnavailable(detail: string): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', detail)
}

export async function saveCharacterSupportAction(
  userId: string,
  character: PersistedCharacter,
  input: { expectedBuildVersion: number; supportActionId: unknown; idempotencyKey: string },
  repository: CharacterBuildRepository,
): Promise<CharacterBuildContext & { replayed: boolean }> {
  validateCommitInput(input)
  const supportActionId = parseSupportActionId(input.supportActionId)
  if (!supportActionId) throw new AurevaneError('INVALID_REQUEST', 'Choose a valid Support Action.')
  await loadCharacterBuildContext(userId, character, repository)
  const requestFingerprint = `sha256:${createHash('sha256')
    .update(
      JSON.stringify({
        command: 'character.support-action.save.v1',
        characterId: character.id,
        expectedBuildVersion: input.expectedBuildVersion,
        supportActionId,
      }),
    )
    .digest('hex')}`
  const saved = await repository.saveSupportAction({
    userId,
    characterId: character.id,
    expectedBuildVersion: input.expectedBuildVersion,
    supportActionId,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint,
  })
  return {
    ...(await loadCharacterBuildContext(userId, character, repository)),
    replayed: saved.replayed,
  }
}
