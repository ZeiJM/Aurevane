import 'server-only'

import { createHash } from 'node:crypto'

import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import {
  buildPrimaryDisciplinePreview,
  type DisciplineDefinition,
  type PrimaryDisciplineBaseProfile,
  type PrimaryDisciplinePreview,
} from '@aurevane/game-core/character/discipline-build'
import {
  disciplineSkillCapacity,
  validateDisciplineSkillLoadout,
  type DisciplineSkillReference,
} from '@aurevane/game-core/character/discipline-skill-loadout'
import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import { AurevaneError } from '@aurevane/game-core/errors'

export interface CharacterAttunementPolicy {
  version: number
  primaryCooldownSeconds: number
  secondaryCooldownSeconds: number
}

export interface CharacterActiveBuildRecord {
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
}

export interface CharacterEquippedDisciplineSkillRecord extends DisciplineSkillReference {
  slotIndex: number
  equippedAt: string
}

export interface CharacterCommittedBuildSnapshotRecord {
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
    resonance: null
    essence: null
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

export interface CharacterBuildRepository {
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
}

export interface CharacterEquippedDisciplineSkill {
  definition: MatureSkillDefinition
  slotIndex: number
  equippedAt: string
}

export interface CharacterDisciplineSkillLoadoutView {
  capacity: number
  learnedSkills: readonly CharacterSkillCatalogEntry[]
  equippedSkills: readonly CharacterEquippedDisciplineSkill[]
  extensions: {
    resonance: null
    essence: null
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
): PrimaryDisciplinePreview {
  return buildPrimaryDisciplinePreview({
    attributes: character.attributes,
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
): PrimaryDisciplineCatalogEntry {
  if (id === context.current.definition.id) {
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

function resolveLearnedSkill(record: CharacterLearnedSkillRecord): CharacterSkillCatalogEntry {
  const definition = resolveMatureSkillVersion(record.skillId, record.contentVersion)
  if (!definition || definition.sourceDisciplineId !== record.sourceDisciplineId) {
    throw persistenceUnavailable('A learned Skill references a stale or disabled content version.')
  }
  return { definition, learnedAt: record.learnedAt, activeSource: false }
}

function resolveEquippedSkill(
  record: CharacterEquippedDisciplineSkillRecord,
): CharacterEquippedDisciplineSkill {
  const definition = resolveMatureSkillVersion(record.skillId, record.contentVersion)
  if (!definition || definition.sourceDisciplineId !== record.sourceDisciplineId) {
    throw persistenceUnavailable(
      'An equipped Skill references a stale or disabled content version.',
    )
  }
  return { definition, slotIndex: record.slotIndex, equippedAt: record.equippedAt }
}

function buildDisciplineSkillView(
  build: CharacterActiveBuildRecord,
  learnedRecords: readonly CharacterLearnedSkillRecord[],
  equippedRecords: readonly CharacterEquippedDisciplineSkillRecord[],
): CharacterDisciplineSkillLoadoutView {
  const activeSources = new Set(
    build.secondaryDefinition
      ? [build.primaryDefinition.id, build.secondaryDefinition.id]
      : [build.primaryDefinition.id],
  )
  const learnedSkills = learnedRecords.map(resolveLearnedSkill).map((entry) => ({
    ...entry,
    activeSource: activeSources.has(entry.definition.sourceDisciplineId),
  }))
  const equippedSkills = equippedRecords.map(resolveEquippedSkill)
  const issues = validateDisciplineSkillLoadout({
    primaryDisciplineId: build.primaryDefinition.id,
    secondaryDisciplineId: build.secondaryDefinition?.id ?? null,
    equipped: equippedSkills.map((entry) => ({
      skillId: entry.definition.id,
      contentVersion: entry.definition.contentVersion,
      sourceDisciplineId: entry.definition.sourceDisciplineId,
    })),
    learned: learnedSkills.map((entry) => ({
      skillId: entry.definition.id,
      contentVersion: entry.definition.contentVersion,
      sourceDisciplineId: entry.definition.sourceDisciplineId,
    })),
  })
  if (issues.length > 0) {
    throw persistenceUnavailable(`The committed Skill loadout is illegal: ${issues[0]?.message}`)
  }

  return {
    capacity: disciplineSkillCapacity(build.secondaryDefinition?.id ?? null),
    learnedSkills,
    equippedSkills,
    extensions: {
      resonance: null,
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
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
    disciplineSkills: buildDisciplineSkillView(build, learnedSkills, equippedSkills),
  }
}

export async function loadCharacterCommittedBuildSnapshot(
  userId: string,
  characterId: string,
  repository: CharacterBuildRepository,
): Promise<CharacterCommittedBuildSnapshotRecord> {
  const snapshot = await repository.loadCommittedBuildSnapshot(userId, characterId)
  if (!snapshot) throw persistenceUnavailable('The committed build snapshot is unavailable.')

  const activeSources = new Set(
    snapshot.secondary
      ? [snapshot.primary.disciplineId, snapshot.secondary.disciplineId]
      : [snapshot.primary.disciplineId],
  )
  for (const skill of snapshot.disciplineSkills) {
    const definition = resolveMatureSkillVersion(skill.skillId, skill.contentVersion)
    if (
      !definition ||
      definition.sourceDisciplineId !== skill.sourceDisciplineId ||
      !activeSources.has(skill.sourceDisciplineId)
    ) {
      throw persistenceUnavailable('The committed build snapshot contains an invalid Skill.')
    }
  }
  if (
    snapshot.disciplineSkills.length >
    disciplineSkillCapacity(snapshot.secondary?.disciplineId ?? null)
  ) {
    throw persistenceUnavailable('The committed build snapshot exceeds Skill capacity.')
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

  const primary = resolvedPrimaryEntry(primaryId, context)
  const secondary = resolvedSecondaryDefinition(secondaryId, context)

  if (secondary?.id === primary.definition.id) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Primary and Secondary Discipline must be different.',
    )
  }

  return {
    current: context.current,
    currentSecondary: context.currentSecondary,
    proposed: calculatePreview(character, primary),
    proposedSecondary: secondary,
    buildVersion: context.build.buildVersion,
    changes: {
      primary: primary.definition.id !== context.current.definition.id,
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

  const context = await loadCharacterBuildContext(userId, character, repository)
  const learnedById = new Map(
    context.disciplineSkills.learnedSkills.map((entry) => [entry.definition.id, entry] as const),
  )
  const selected = input.skillIds.map((candidate) => {
    const skillId = candidate.trim()
    const entry = learnedById.get(skillId)
    if (!skillId || !entry) {
      throw new AurevaneError('INVALID_REQUEST', 'Only learned Discipline Skills may be equipped.')
    }
    return {
      skillId: entry.definition.id,
      contentVersion: entry.definition.contentVersion,
      sourceDisciplineId: entry.definition.sourceDisciplineId,
    } satisfies DisciplineSkillReference
  })

  const issues = validateDisciplineSkillLoadout({
    primaryDisciplineId: context.current.definition.id,
    secondaryDisciplineId: context.currentSecondary?.id ?? null,
    equipped: selected,
    learned: context.disciplineSkills.learnedSkills.map((entry) => ({
      skillId: entry.definition.id,
      contentVersion: entry.definition.contentVersion,
      sourceDisciplineId: entry.definition.sourceDisciplineId,
    })),
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
    currentIds.every((skillId, index) => skillId === selected[index]?.skillId)
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

  const primary = resolvedPrimaryEntry(primaryId, context)
  const secondary = resolvedSecondaryDefinition(secondaryId, context)

  if (secondary?.id === primary.definition.id) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Primary and Secondary Discipline must be different.',
    )
  }

  const changePrimary = primary.definition.id !== context.current.definition.id
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
