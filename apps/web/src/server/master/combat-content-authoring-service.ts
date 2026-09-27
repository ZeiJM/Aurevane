import 'server-only'

import type {
  CombatContentDefinition,
  CombatContentDraftRecord,
  CombatContentRepository,
  CombatContentVersionRecord,
} from '@aurevane/db/combat-content'
import { CombatContentConflictError } from '@aurevane/db/combat-content'
import { validateCombatActionDefinition } from '@aurevane/game-core/combat/combat-authoring-validation'
import {
  resolveEssenceForBuild,
  validateEssenceDefinition as validateCanonicalEssenceDefinition,
  type EssenceDefinition,
} from '@aurevane/game-core/combat/essence'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  toCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  resolveResonanceForPair,
  validateResonanceDefinition as validateCanonicalResonanceDefinition,
  type ResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
import { AurevaneError } from '@aurevane/game-core/errors'

import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'
import { isRegisteredSkillAudioCueHook, isRegisteredSkillIconHook } from '@/media/skill-media-hooks'

import {
  previewCombatContentDefinition,
  type CombatContentPreviewResult,
} from './combat-content-preview'

export type MasterPanelOperatorRole = 'owner' | 'content-staff'

export interface CombatContentAuthoringStore extends CombatContentRepository {
  getOperatorRole(userId: string): Promise<MasterPanelOperatorRole | null>
}

export interface CombatContentValidationIssue {
  readonly path: string
  readonly code: string
  readonly message: string
}

export interface CombatContentValidationResult {
  readonly valid: boolean
  readonly issues: readonly CombatContentValidationIssue[]
  readonly derivedTags: readonly string[]
}

export interface CombatContentSemanticDiff {
  readonly changedPaths: readonly string[]
}

export interface CombatContentAuthoringService {
  requireOperator(actorUserId: string): Promise<MasterPanelOperatorRole>
  validateSkillDefinition(definition: unknown): CombatContentValidationResult
  validateEssenceDefinition(definition: unknown): CombatContentValidationResult
  validateResonanceDefinition(definition: unknown): CombatContentValidationResult
  previewSkillDefinition(input: {
    actorUserId: string
    definition: unknown
    seed?: number
    combatContext?: MatureSkillCombatContext
  }): Promise<CombatContentPreviewResult>
  diffSkillDefinitions(before: unknown, after: unknown): CombatContentSemanticDiff
  saveSkillDraft(input: {
    actorUserId: string
    definition: unknown
    baseVersion: number | null
    expectedDraftVersion: number | null
  }): Promise<CombatContentDraftRecord>
  publishSkill(input: {
    actorUserId: string
    definition: unknown
    expectedBaseVersion: number | null
  }): Promise<CombatContentVersionRecord>
  rollbackSkill(input: {
    actorUserId: string
    skillId: string
    targetVersion: number
  }): Promise<void>
  saveEssenceDraft(input: {
    actorUserId: string
    definition: unknown
    baseVersion: number | null
    expectedDraftVersion: number | null
  }): Promise<CombatContentDraftRecord>
  publishEssence(input: {
    actorUserId: string
    definition: unknown
    expectedBaseVersion: number | null
  }): Promise<CombatContentVersionRecord>
  rollbackEssence(input: {
    actorUserId: string
    essenceId: string
    sourceDisciplineId: string
    targetVersion: number
  }): Promise<void>
  saveResonanceDraft(input: {
    actorUserId: string
    definition: unknown
    baseVersion: number | null
    expectedDraftVersion: number | null
  }): Promise<CombatContentDraftRecord>
  publishResonance(input: {
    actorUserId: string
    definition: unknown
    expectedBaseVersion: number | null
  }): Promise<CombatContentVersionRecord>
  rollbackResonance(input: {
    actorUserId: string
    resonanceId: string
    disciplinePair: readonly [string, string]
    targetVersion: number
  }): Promise<void>
}

interface Dependencies {
  store: CombatContentAuthoringStore
  resolver: CombatContentResolver
}

const FORBIDDEN_DRAFT_FIELDS = new Set([
  'presentationTags',
  'derivedTags',
  'script',
  'sourceCode',
  'handler',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readSkillId(definition: unknown): string | null {
  if (!isRecord(definition)) return null
  return typeof definition.id === 'string' && definition.id.length > 0 ? definition.id : null
}

function readEssenceId(definition: unknown): string | null {
  if (!isRecord(definition)) return null
  return typeof definition.essenceId === 'string' && definition.essenceId.length > 0
    ? definition.essenceId
    : null
}

function readResonanceId(definition: unknown): string | null {
  return readSkillId(definition)
}

function forbiddenDraftFieldIssues(
  value: unknown,
  path = '$',
  seen = new WeakSet<object>(),
): CombatContentValidationIssue[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      forbiddenDraftFieldIssues(entry, `${path}[${index}]`, seen),
    )
  }
  if (!isRecord(value) || seen.has(value)) return []
  seen.add(value)

  const issues: CombatContentValidationIssue[] = []
  for (const [field, nested] of Object.entries(value)) {
    const fieldPath = path === '$' ? field : `${path}.${field}`
    if (FORBIDDEN_DRAFT_FIELDS.has(field)) {
      issues.push({
        path: fieldPath,
        code:
          field === 'presentationTags' || field === 'derivedTags'
            ? 'DERIVED_PRESENTATION_FIELD'
            : 'ARBITRARY_SCRIPT_FIELD',
        message:
          field === 'presentationTags' || field === 'derivedTags'
            ? 'Presentation tags are derived from canonical target and effect semantics.'
            : 'Combat content cannot contain arbitrary executable script fields.',
      })
    }
    issues.push(...forbiddenDraftFieldIssues(nested, fieldPath, seen))
  }
  return issues
}

function draftShapeIssues(definition: unknown): CombatContentValidationIssue[] {
  if (!isRecord(definition)) {
    return [
      {
        path: '$',
        code: 'INVALID_DEFINITION_SHAPE',
        message: 'Skill content must be a typed object definition.',
      },
    ]
  }

  const issues = forbiddenDraftFieldIssues(definition)
  if (!readSkillId(definition)) {
    issues.push({ path: 'id', code: 'INVALID_SKILL_ID', message: 'Skill id is required.' })
  }
  return issues
}

function draftShapeIssuesForIdentity(
  definition: unknown,
  identityField: 'essenceId' | 'id',
  label: 'Essence' | 'Resonance',
): CombatContentValidationIssue[] {
  if (!isRecord(definition)) {
    return [
      {
        path: '
function validateSkillDefinition(definition: unknown): CombatContentValidationResult {
  const issues = draftShapeIssues(definition)
  if (!isRecord(definition) || issues.length > 0) {
    return { valid: false, issues, derivedTags: [] }
  }

  const candidate = structuredClone(definition) as unknown as MatureSkillDefinition
  try {
    for (const field of validateMatureSkillDefinition(candidate)) {
      issues.push({
        path: field,
        code: 'INVALID_MATURE_SKILL_FIELD',
        message: `Mature Skill validation rejected ${field}.`,
      })
    }
  } catch (error) {
    issues.push({
      path: '$',
      code: 'INVALID_MATURE_SKILL_SHAPE',
      message: normalizeMessage(error),
    })
  }

  if (issues.length === 0) {
    if (!isRegisteredSkillIconHook(candidate.media.iconKey)) {
      issues.push({
        path: 'media.iconKey',
        code: 'UNKNOWN_MEDIA_HOOK',
        message: 'Skill artwork must use a registered approved media hook.',
      })
    }
    if (!isRegisteredSkillAudioCueHook(candidate.media.audioCueKey)) {
      issues.push({
        path: 'media.audioCueKey',
        code: 'UNKNOWN_MEDIA_HOOK',
        message: 'Skill audio must use a registered media hook.',
      })
    }
  }

  if (issues.length === 0) {
    for (const context of ['pve', 'pvp'] as const) {
      try {
        const action = toCombatActionDefinition(candidate, context)
        validateCombatActionDefinition(action)
      } catch (error) {
        issues.push({
          path: context,
          code: 'INVALID_COMBAT_ACTION',
          message: normalizeMessage(error),
        })
      }
    }
  }

  if (issues.length > 0) return { valid: false, issues, derivedTags: [] }

  try {
    return {
      valid: true,
      issues: [],
      derivedTags: combatActionPresentationTags(toCombatActionDefinition(candidate, 'pve')),
    }
  } catch (error) {
    return {
      valid: false,
      issues: [
        {
          path: '$',
          code: 'INVALID_PRESENTATION_PROJECTION',
          message: normalizeMessage(error),
        },
      ],
      derivedTags: [],
    }
  }
}

function semanticChangedPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (Object.is(before, after)) return []
  if (Array.isArray(before) || Array.isArray(after)) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix || '$']
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    const changed: string[] = []
    for (const key of [...keys].sort()) {
      if (key === 'contentVersion' || key === 'presentationTags' || key === 'derivedTags') continue
      const path = prefix ? `${prefix}.${key}` : key
      changed.push(...semanticChangedPaths(before[key], after[key], path))
    }
    return changed
  }
  return [prefix || '$']
}

function mapRepositoryConflict(error: unknown): never {
  if (error instanceof CombatContentConflictError) {
    if (
      error.code === 'COMBAT_CONTENT_BASE_VERSION_CONFLICT' ||
      error.code === 'COMBAT_CONTENT_DRAFT_VERSION_CONFLICT'
    ) {
      throw new AurevaneError(
        'STALE_VERSION',
        'Combat content changed. Refresh the authoritative version and retry.',
        { cause: error },
      )
    }
    throw new AurevaneError('INVALID_REQUEST', error.message, { cause: error })
  }
  throw error
}

async function authorizeOperator(
  store: CombatContentAuthoringStore,
  actorUserId: string,
): Promise<MasterPanelOperatorRole> {
  const role = await store.getOperatorRole(actorUserId)
  if (role !== 'owner' && role !== 'content-staff') {
    throw new AurevaneError(
      'FORBIDDEN',
      'Master Panel combat authoring is not available to this account.',
    )
  }
  return role
}

function assertDraftShape(definition: unknown): asserts definition is Record<string, unknown> {
  const issues = draftShapeIssues(definition)
  if (issues.length > 0) {
    throw new AurevaneError('INVALID_REQUEST', issues[0]!.message)
  }
}

export function createCombatContentAuthoringService({
  store,
  resolver,
}: Dependencies): CombatContentAuthoringService {
  return {
    requireOperator(actorUserId) {
      return authorizeOperator(store, actorUserId)
    },

    validateSkillDefinition,
    validateEssenceDefinition: validateEssenceAuthoringDefinition,
    validateResonanceDefinition: validateResonanceAuthoringDefinition,

    async previewSkillDefinition(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateSkillDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Skill definition.'}`,
        )
      }

      return previewCombatContentDefinition(input.definition as MatureSkillDefinition, {
        ...(input.seed === undefined ? {} : { seed: input.seed }),
        ...(input.combatContext === undefined ? {} : { combatContext: input.combatContext }),
      })
    },

    diffSkillDefinitions(before, after) {
      return { changedPaths: semanticChangedPaths(before, after) }
    },

    async saveSkillDraft(input) {
      await authorizeOperator(store, input.actorUserId)
      assertDraftShape(input.definition)
      const skillId = readSkillId(input.definition)!
      try {
        return await store.saveDraft({
          contentKey: skillId,
          contentKind: 'skill',
          definition: structuredClone(input.definition) as CombatContentDefinition,
          baseVersion: input.baseVersion,
          expectedDraftVersion: input.expectedDraftVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async publishSkill(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateSkillDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Skill definition.'}`,
        )
      }
      const definition = input.definition as MatureSkillDefinition
      const current = await resolver.resolveCurrentSkillDefinition(definition.id)
      const actualBaseVersion = current?.contentVersion ?? null
      if (actualBaseVersion !== input.expectedBaseVersion) {
        throw new AurevaneError(
          'STALE_VERSION',
          'Combat content changed. Refresh the authoritative version and retry.',
        )
      }

      try {
        return await store.publish({
          contentKey: definition.id,
          contentKind: 'skill',
          definition: structuredClone(definition) as unknown as CombatContentDefinition,
          expectedBaseVersion: input.expectedBaseVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async rollbackSkill(input) {
      await authorizeOperator(store, input.actorUserId)
      if (!Number.isSafeInteger(input.targetVersion) || input.targetVersion < 1) {
        throw new AurevaneError('INVALID_REQUEST', 'Rollback target must be a positive version.')
      }

      const target = await resolver.resolvePinnedSkillDefinition(input.skillId, input.targetVersion)
      if (!target || target.id !== input.skillId || !target.enabled) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'That rollback target is not an enabled Skill version.',
        )
      }

      const stored = (await store.listPublishedVersions(input.skillId)).some(
        (version) => version.contentVersion === input.targetVersion,
      )
      try {
        await store.setCurrentPublication(
          input.skillId,
          stored ? input.targetVersion : null,
          input.actorUserId,
        )
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async saveEssenceDraft(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateEssenceAuthoringDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Essence definition.'}`,
        )
      }
      const essenceId = readEssenceId(input.definition)!
      try {
        return await store.saveDraft({
          contentKey: essenceId,
          contentKind: 'essence',
          definition: structuredClone(input.definition) as CombatContentDefinition,
          baseVersion: input.baseVersion,
          expectedDraftVersion: input.expectedDraftVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async publishEssence(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateEssenceAuthoringDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Essence definition.'}`,
        )
      }
      const definition = input.definition as EssenceDefinition
      const published = await store.findPublished(definition.essenceId)
      if (published && published.contentKind !== 'essence') {
        throw new AurevaneError('INVALID_REQUEST', 'Combat content kind conflict.')
      }
      const fallback = published
        ? null
        : resolveEssenceForBuild(definition.sourceDisciplineId, null)
      const actualBaseVersion = published?.contentVersion ?? (
        fallback?.essenceId === definition.essenceId ? fallback.contentVersion : null
      )
      if (actualBaseVersion !== input.expectedBaseVersion) {
        throw new AurevaneError(
          'STALE_VERSION',
          'Combat content changed. Refresh the authoritative version and retry.',
        )
      }

      try {
        return await store.publish({
          contentKey: definition.essenceId,
          contentKind: 'essence',
          definition: structuredClone(definition) as unknown as CombatContentDefinition,
          expectedBaseVersion: input.expectedBaseVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async rollbackEssence(input) {
      await authorizeOperator(store, input.actorUserId)
      if (!Number.isSafeInteger(input.targetVersion) || input.targetVersion < 1) {
        throw new AurevaneError('INVALID_REQUEST', 'Rollback target must be a positive version.')
      }

      const storedVersions = await store.listPublishedVersions(input.essenceId)
      const stored = storedVersions.some(
        (version) =>
          version.contentKind === 'essence' && version.contentVersion === input.targetVersion,
      )
      const fallback = stored
        ? null
        : resolveEssenceForBuild(input.sourceDisciplineId, null, input.targetVersion)
      if (
        !stored &&
        (!fallback || fallback.essenceId !== input.essenceId || !fallback.enabled)
      ) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'That rollback target is not an enabled Essence version.',
        )
      }
      try {
        await store.setCurrentPublication(
          input.essenceId,
          stored ? input.targetVersion : null,
          input.actorUserId,
        )
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async saveResonanceDraft(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateResonanceAuthoringDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Resonance definition.'}`,
        )
      }
      const resonanceId = readResonanceId(input.definition)!
      try {
        return await store.saveDraft({
          contentKey: resonanceId,
          contentKind: 'resonance',
          definition: structuredClone(input.definition) as CombatContentDefinition,
          baseVersion: input.baseVersion,
          expectedDraftVersion: input.expectedDraftVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async publishResonance(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateResonanceAuthoringDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Resonance definition.'}`,
        )
      }
      const definition = input.definition as ResonanceDefinition
      const published = await store.findPublished(definition.id)
      if (published && published.contentKind !== 'resonance') {
        throw new AurevaneError('INVALID_REQUEST', 'Combat content kind conflict.')
      }
      const fallback = published
        ? null
        : resolveResonanceForPair(definition.disciplinePair[0], definition.disciplinePair[1])
      const actualBaseVersion = published?.contentVersion ?? (
        fallback?.id === definition.id ? fallback.contentVersion : null
      )
      if (actualBaseVersion !== input.expectedBaseVersion) {
        throw new AurevaneError(
          'STALE_VERSION',
          'Combat content changed. Refresh the authoritative version and retry.',
        )
      }

      try {
        return await store.publish({
          contentKey: definition.id,
          contentKind: 'resonance',
          definition: structuredClone(definition) as unknown as CombatContentDefinition,
          expectedBaseVersion: input.expectedBaseVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async rollbackResonance(input) {
      await authorizeOperator(store, input.actorUserId)
      if (!Number.isSafeInteger(input.targetVersion) || input.targetVersion < 1) {
        throw new AurevaneError('INVALID_REQUEST', 'Rollback target must be a positive version.')
      }

      const storedVersions = await store.listPublishedVersions(input.resonanceId)
      const stored = storedVersions.some(
        (version) =>
          version.contentKind === 'resonance' && version.contentVersion === input.targetVersion,
      )
      const fallback = stored
        ? null
        : resolveResonanceForPair(
            input.disciplinePair[0],
            input.disciplinePair[1],
            input.targetVersion,
          )
      if (!stored && (!fallback || fallback.id !== input.resonanceId || !fallback.enabled)) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'That rollback target is not an enabled Resonance version.',
        )
      }
      try {
        await store.setCurrentPublication(
          input.resonanceId,
          stored ? input.targetVersion : null,
          input.actorUserId,
        )
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },
  }
}
,
        code: 'INVALID_DEFINITION_SHAPE',
        message: `${label} content must be a typed object definition.`,
      },
    ]
  }

  const issues = forbiddenDraftFieldIssues(definition)
  const identity =
    identityField === 'essenceId' ? readEssenceId(definition) : readResonanceId(definition)
  if (!identity) {
    issues.push({
      path: identityField,
      code: `INVALID_${label.toUpperCase()}_ID`,
      message: `${label} id is required.`,
    })
  }
  return issues
}

function validateEssenceAuthoringDefinition(definition: unknown): CombatContentValidationResult {
  const issues = draftShapeIssuesForIdentity(definition, 'essenceId', 'Essence')
  if (!isRecord(definition) || issues.length > 0) {
    return { valid: false, issues, derivedTags: [] }
  }

  const candidate = structuredClone(definition) as unknown as EssenceDefinition
  try {
    for (const field of validateCanonicalEssenceDefinition(candidate)) {
      issues.push({
        path: field,
        code: 'INVALID_ESSENCE_FIELD',
        message: `Essence validation rejected ${field}.`,
      })
    }
  } catch (error) {
    issues.push({
      path: '
function validateSkillDefinition(definition: unknown): CombatContentValidationResult {
  const issues = draftShapeIssues(definition)
  if (!isRecord(definition) || issues.length > 0) {
    return { valid: false, issues, derivedTags: [] }
  }

  const candidate = structuredClone(definition) as unknown as MatureSkillDefinition
  try {
    for (const field of validateMatureSkillDefinition(candidate)) {
      issues.push({
        path: field,
        code: 'INVALID_MATURE_SKILL_FIELD',
        message: `Mature Skill validation rejected ${field}.`,
      })
    }
  } catch (error) {
    issues.push({
      path: '$',
      code: 'INVALID_MATURE_SKILL_SHAPE',
      message: normalizeMessage(error),
    })
  }

  if (issues.length === 0) {
    if (!isRegisteredSkillIconHook(candidate.media.iconKey)) {
      issues.push({
        path: 'media.iconKey',
        code: 'UNKNOWN_MEDIA_HOOK',
        message: 'Skill artwork must use a registered approved media hook.',
      })
    }
    if (!isRegisteredSkillAudioCueHook(candidate.media.audioCueKey)) {
      issues.push({
        path: 'media.audioCueKey',
        code: 'UNKNOWN_MEDIA_HOOK',
        message: 'Skill audio must use a registered media hook.',
      })
    }
  }

  if (issues.length === 0) {
    for (const context of ['pve', 'pvp'] as const) {
      try {
        const action = toCombatActionDefinition(candidate, context)
        validateCombatActionDefinition(action)
      } catch (error) {
        issues.push({
          path: context,
          code: 'INVALID_COMBAT_ACTION',
          message: normalizeMessage(error),
        })
      }
    }
  }

  if (issues.length > 0) return { valid: false, issues, derivedTags: [] }

  try {
    return {
      valid: true,
      issues: [],
      derivedTags: combatActionPresentationTags(toCombatActionDefinition(candidate, 'pve')),
    }
  } catch (error) {
    return {
      valid: false,
      issues: [
        {
          path: '$',
          code: 'INVALID_PRESENTATION_PROJECTION',
          message: normalizeMessage(error),
        },
      ],
      derivedTags: [],
    }
  }
}

function semanticChangedPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (Object.is(before, after)) return []
  if (Array.isArray(before) || Array.isArray(after)) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix || '$']
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    const changed: string[] = []
    for (const key of [...keys].sort()) {
      if (key === 'contentVersion' || key === 'presentationTags' || key === 'derivedTags') continue
      const path = prefix ? `${prefix}.${key}` : key
      changed.push(...semanticChangedPaths(before[key], after[key], path))
    }
    return changed
  }
  return [prefix || '$']
}

function mapRepositoryConflict(error: unknown): never {
  if (error instanceof CombatContentConflictError) {
    if (
      error.code === 'COMBAT_CONTENT_BASE_VERSION_CONFLICT' ||
      error.code === 'COMBAT_CONTENT_DRAFT_VERSION_CONFLICT'
    ) {
      throw new AurevaneError(
        'STALE_VERSION',
        'Combat content changed. Refresh the authoritative version and retry.',
        { cause: error },
      )
    }
    throw new AurevaneError('INVALID_REQUEST', error.message, { cause: error })
  }
  throw error
}

async function authorizeOperator(
  store: CombatContentAuthoringStore,
  actorUserId: string,
): Promise<MasterPanelOperatorRole> {
  const role = await store.getOperatorRole(actorUserId)
  if (role !== 'owner' && role !== 'content-staff') {
    throw new AurevaneError(
      'FORBIDDEN',
      'Master Panel combat authoring is not available to this account.',
    )
  }
  return role
}

function assertDraftShape(definition: unknown): asserts definition is Record<string, unknown> {
  const issues = draftShapeIssues(definition)
  if (issues.length > 0) {
    throw new AurevaneError('INVALID_REQUEST', issues[0]!.message)
  }
}

export function createCombatContentAuthoringService({
  store,
  resolver,
}: Dependencies): CombatContentAuthoringService {
  return {
    requireOperator(actorUserId) {
      return authorizeOperator(store, actorUserId)
    },

    validateSkillDefinition,

    async previewSkillDefinition(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateSkillDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Skill definition.'}`,
        )
      }

      return previewCombatContentDefinition(input.definition as MatureSkillDefinition, {
        ...(input.seed === undefined ? {} : { seed: input.seed }),
        ...(input.combatContext === undefined ? {} : { combatContext: input.combatContext }),
      })
    },

    diffSkillDefinitions(before, after) {
      return { changedPaths: semanticChangedPaths(before, after) }
    },

    async saveSkillDraft(input) {
      await authorizeOperator(store, input.actorUserId)
      assertDraftShape(input.definition)
      const skillId = readSkillId(input.definition)!
      try {
        return await store.saveDraft({
          contentKey: skillId,
          contentKind: 'skill',
          definition: structuredClone(input.definition) as CombatContentDefinition,
          baseVersion: input.baseVersion,
          expectedDraftVersion: input.expectedDraftVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async publishSkill(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateSkillDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Skill definition.'}`,
        )
      }
      const definition = input.definition as MatureSkillDefinition
      const current = await resolver.resolveCurrentSkillDefinition(definition.id)
      const actualBaseVersion = current?.contentVersion ?? null
      if (actualBaseVersion !== input.expectedBaseVersion) {
        throw new AurevaneError(
          'STALE_VERSION',
          'Combat content changed. Refresh the authoritative version and retry.',
        )
      }

      try {
        return await store.publish({
          contentKey: definition.id,
          contentKind: 'skill',
          definition: structuredClone(definition) as unknown as CombatContentDefinition,
          expectedBaseVersion: input.expectedBaseVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async rollbackSkill(input) {
      await authorizeOperator(store, input.actorUserId)
      if (!Number.isSafeInteger(input.targetVersion) || input.targetVersion < 1) {
        throw new AurevaneError('INVALID_REQUEST', 'Rollback target must be a positive version.')
      }

      const target = await resolver.resolvePinnedSkillDefinition(input.skillId, input.targetVersion)
      if (!target || target.id !== input.skillId || !target.enabled) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'That rollback target is not an enabled Skill version.',
        )
      }

      const stored = (await store.listPublishedVersions(input.skillId)).some(
        (version) => version.contentVersion === input.targetVersion,
      )
      try {
        await store.setCurrentPublication(
          input.skillId,
          stored ? input.targetVersion : null,
          input.actorUserId,
        )
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },
  }
}
,
      code: 'INVALID_ESSENCE_SHAPE',
      message: normalizeMessage(error),
    })
  }

  if (issues.length === 0) {
    const skillValidation = validateSkillDefinition(candidate.skill)
    for (const issue of skillValidation.issues) {
      issues.push({ ...issue, path: `skill.${issue.path}` })
    }
  }
  if (issues.length > 0) return { valid: false, issues, derivedTags: [] }

  return {
    valid: true,
    issues: [],
    derivedTags: combatActionPresentationTags(toCombatActionDefinition(candidate.skill, 'pve')),
  }
}

function validateResonanceAuthoringDefinition(definition: unknown): CombatContentValidationResult {
  const issues = draftShapeIssuesForIdentity(definition, 'id', 'Resonance')
  if (!isRecord(definition) || issues.length > 0) {
    return { valid: false, issues, derivedTags: [] }
  }

  const candidate = structuredClone(definition) as unknown as ResonanceDefinition
  try {
    for (const field of validateCanonicalResonanceDefinition(candidate)) {
      issues.push({
        path: field,
        code: 'INVALID_RESONANCE_FIELD',
        message: `Resonance validation rejected ${field}.`,
      })
    }
  } catch (error) {
    issues.push({
      path: '
function validateSkillDefinition(definition: unknown): CombatContentValidationResult {
  const issues = draftShapeIssues(definition)
  if (!isRecord(definition) || issues.length > 0) {
    return { valid: false, issues, derivedTags: [] }
  }

  const candidate = structuredClone(definition) as unknown as MatureSkillDefinition
  try {
    for (const field of validateMatureSkillDefinition(candidate)) {
      issues.push({
        path: field,
        code: 'INVALID_MATURE_SKILL_FIELD',
        message: `Mature Skill validation rejected ${field}.`,
      })
    }
  } catch (error) {
    issues.push({
      path: '$',
      code: 'INVALID_MATURE_SKILL_SHAPE',
      message: normalizeMessage(error),
    })
  }

  if (issues.length === 0) {
    if (!isRegisteredSkillIconHook(candidate.media.iconKey)) {
      issues.push({
        path: 'media.iconKey',
        code: 'UNKNOWN_MEDIA_HOOK',
        message: 'Skill artwork must use a registered approved media hook.',
      })
    }
    if (!isRegisteredSkillAudioCueHook(candidate.media.audioCueKey)) {
      issues.push({
        path: 'media.audioCueKey',
        code: 'UNKNOWN_MEDIA_HOOK',
        message: 'Skill audio must use a registered media hook.',
      })
    }
  }

  if (issues.length === 0) {
    for (const context of ['pve', 'pvp'] as const) {
      try {
        const action = toCombatActionDefinition(candidate, context)
        validateCombatActionDefinition(action)
      } catch (error) {
        issues.push({
          path: context,
          code: 'INVALID_COMBAT_ACTION',
          message: normalizeMessage(error),
        })
      }
    }
  }

  if (issues.length > 0) return { valid: false, issues, derivedTags: [] }

  try {
    return {
      valid: true,
      issues: [],
      derivedTags: combatActionPresentationTags(toCombatActionDefinition(candidate, 'pve')),
    }
  } catch (error) {
    return {
      valid: false,
      issues: [
        {
          path: '$',
          code: 'INVALID_PRESENTATION_PROJECTION',
          message: normalizeMessage(error),
        },
      ],
      derivedTags: [],
    }
  }
}

function semanticChangedPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (Object.is(before, after)) return []
  if (Array.isArray(before) || Array.isArray(after)) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix || '$']
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    const changed: string[] = []
    for (const key of [...keys].sort()) {
      if (key === 'contentVersion' || key === 'presentationTags' || key === 'derivedTags') continue
      const path = prefix ? `${prefix}.${key}` : key
      changed.push(...semanticChangedPaths(before[key], after[key], path))
    }
    return changed
  }
  return [prefix || '$']
}

function mapRepositoryConflict(error: unknown): never {
  if (error instanceof CombatContentConflictError) {
    if (
      error.code === 'COMBAT_CONTENT_BASE_VERSION_CONFLICT' ||
      error.code === 'COMBAT_CONTENT_DRAFT_VERSION_CONFLICT'
    ) {
      throw new AurevaneError(
        'STALE_VERSION',
        'Combat content changed. Refresh the authoritative version and retry.',
        { cause: error },
      )
    }
    throw new AurevaneError('INVALID_REQUEST', error.message, { cause: error })
  }
  throw error
}

async function authorizeOperator(
  store: CombatContentAuthoringStore,
  actorUserId: string,
): Promise<MasterPanelOperatorRole> {
  const role = await store.getOperatorRole(actorUserId)
  if (role !== 'owner' && role !== 'content-staff') {
    throw new AurevaneError(
      'FORBIDDEN',
      'Master Panel combat authoring is not available to this account.',
    )
  }
  return role
}

function assertDraftShape(definition: unknown): asserts definition is Record<string, unknown> {
  const issues = draftShapeIssues(definition)
  if (issues.length > 0) {
    throw new AurevaneError('INVALID_REQUEST', issues[0]!.message)
  }
}

export function createCombatContentAuthoringService({
  store,
  resolver,
}: Dependencies): CombatContentAuthoringService {
  return {
    requireOperator(actorUserId) {
      return authorizeOperator(store, actorUserId)
    },

    validateSkillDefinition,

    async previewSkillDefinition(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateSkillDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Skill definition.'}`,
        )
      }

      return previewCombatContentDefinition(input.definition as MatureSkillDefinition, {
        ...(input.seed === undefined ? {} : { seed: input.seed }),
        ...(input.combatContext === undefined ? {} : { combatContext: input.combatContext }),
      })
    },

    diffSkillDefinitions(before, after) {
      return { changedPaths: semanticChangedPaths(before, after) }
    },

    async saveSkillDraft(input) {
      await authorizeOperator(store, input.actorUserId)
      assertDraftShape(input.definition)
      const skillId = readSkillId(input.definition)!
      try {
        return await store.saveDraft({
          contentKey: skillId,
          contentKind: 'skill',
          definition: structuredClone(input.definition) as CombatContentDefinition,
          baseVersion: input.baseVersion,
          expectedDraftVersion: input.expectedDraftVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async publishSkill(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateSkillDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Skill definition.'}`,
        )
      }
      const definition = input.definition as MatureSkillDefinition
      const current = await resolver.resolveCurrentSkillDefinition(definition.id)
      const actualBaseVersion = current?.contentVersion ?? null
      if (actualBaseVersion !== input.expectedBaseVersion) {
        throw new AurevaneError(
          'STALE_VERSION',
          'Combat content changed. Refresh the authoritative version and retry.',
        )
      }

      try {
        return await store.publish({
          contentKey: definition.id,
          contentKind: 'skill',
          definition: structuredClone(definition) as unknown as CombatContentDefinition,
          expectedBaseVersion: input.expectedBaseVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async rollbackSkill(input) {
      await authorizeOperator(store, input.actorUserId)
      if (!Number.isSafeInteger(input.targetVersion) || input.targetVersion < 1) {
        throw new AurevaneError('INVALID_REQUEST', 'Rollback target must be a positive version.')
      }

      const target = await resolver.resolvePinnedSkillDefinition(input.skillId, input.targetVersion)
      if (!target || target.id !== input.skillId || !target.enabled) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'That rollback target is not an enabled Skill version.',
        )
      }

      const stored = (await store.listPublishedVersions(input.skillId)).some(
        (version) => version.contentVersion === input.targetVersion,
      )
      try {
        await store.setCurrentPublication(
          input.skillId,
          stored ? input.targetVersion : null,
          input.actorUserId,
        )
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },
  }
}
,
      code: 'INVALID_RESONANCE_SHAPE',
      message: normalizeMessage(error),
    })
  }

  return { valid: issues.length === 0, issues, derivedTags: [] }
}

function normalizeMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Combat definition is invalid.'
}

function validateSkillDefinition(definition: unknown): CombatContentValidationResult {
  const issues = draftShapeIssues(definition)
  if (!isRecord(definition) || issues.length > 0) {
    return { valid: false, issues, derivedTags: [] }
  }

  const candidate = structuredClone(definition) as unknown as MatureSkillDefinition
  try {
    for (const field of validateMatureSkillDefinition(candidate)) {
      issues.push({
        path: field,
        code: 'INVALID_MATURE_SKILL_FIELD',
        message: `Mature Skill validation rejected ${field}.`,
      })
    }
  } catch (error) {
    issues.push({
      path: '$',
      code: 'INVALID_MATURE_SKILL_SHAPE',
      message: normalizeMessage(error),
    })
  }

  if (issues.length === 0) {
    if (!isRegisteredSkillIconHook(candidate.media.iconKey)) {
      issues.push({
        path: 'media.iconKey',
        code: 'UNKNOWN_MEDIA_HOOK',
        message: 'Skill artwork must use a registered approved media hook.',
      })
    }
    if (!isRegisteredSkillAudioCueHook(candidate.media.audioCueKey)) {
      issues.push({
        path: 'media.audioCueKey',
        code: 'UNKNOWN_MEDIA_HOOK',
        message: 'Skill audio must use a registered media hook.',
      })
    }
  }

  if (issues.length === 0) {
    for (const context of ['pve', 'pvp'] as const) {
      try {
        const action = toCombatActionDefinition(candidate, context)
        validateCombatActionDefinition(action)
      } catch (error) {
        issues.push({
          path: context,
          code: 'INVALID_COMBAT_ACTION',
          message: normalizeMessage(error),
        })
      }
    }
  }

  if (issues.length > 0) return { valid: false, issues, derivedTags: [] }

  try {
    return {
      valid: true,
      issues: [],
      derivedTags: combatActionPresentationTags(toCombatActionDefinition(candidate, 'pve')),
    }
  } catch (error) {
    return {
      valid: false,
      issues: [
        {
          path: '$',
          code: 'INVALID_PRESENTATION_PROJECTION',
          message: normalizeMessage(error),
        },
      ],
      derivedTags: [],
    }
  }
}

function semanticChangedPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (Object.is(before, after)) return []
  if (Array.isArray(before) || Array.isArray(after)) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix || '$']
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    const changed: string[] = []
    for (const key of [...keys].sort()) {
      if (key === 'contentVersion' || key === 'presentationTags' || key === 'derivedTags') continue
      const path = prefix ? `${prefix}.${key}` : key
      changed.push(...semanticChangedPaths(before[key], after[key], path))
    }
    return changed
  }
  return [prefix || '$']
}

function mapRepositoryConflict(error: unknown): never {
  if (error instanceof CombatContentConflictError) {
    if (
      error.code === 'COMBAT_CONTENT_BASE_VERSION_CONFLICT' ||
      error.code === 'COMBAT_CONTENT_DRAFT_VERSION_CONFLICT'
    ) {
      throw new AurevaneError(
        'STALE_VERSION',
        'Combat content changed. Refresh the authoritative version and retry.',
        { cause: error },
      )
    }
    throw new AurevaneError('INVALID_REQUEST', error.message, { cause: error })
  }
  throw error
}

async function authorizeOperator(
  store: CombatContentAuthoringStore,
  actorUserId: string,
): Promise<MasterPanelOperatorRole> {
  const role = await store.getOperatorRole(actorUserId)
  if (role !== 'owner' && role !== 'content-staff') {
    throw new AurevaneError(
      'FORBIDDEN',
      'Master Panel combat authoring is not available to this account.',
    )
  }
  return role
}

function assertDraftShape(definition: unknown): asserts definition is Record<string, unknown> {
  const issues = draftShapeIssues(definition)
  if (issues.length > 0) {
    throw new AurevaneError('INVALID_REQUEST', issues[0]!.message)
  }
}

export function createCombatContentAuthoringService({
  store,
  resolver,
}: Dependencies): CombatContentAuthoringService {
  return {
    requireOperator(actorUserId) {
      return authorizeOperator(store, actorUserId)
    },

    validateSkillDefinition,

    async previewSkillDefinition(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateSkillDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Skill definition.'}`,
        )
      }

      return previewCombatContentDefinition(input.definition as MatureSkillDefinition, {
        ...(input.seed === undefined ? {} : { seed: input.seed }),
        ...(input.combatContext === undefined ? {} : { combatContext: input.combatContext }),
      })
    },

    diffSkillDefinitions(before, after) {
      return { changedPaths: semanticChangedPaths(before, after) }
    },

    async saveSkillDraft(input) {
      await authorizeOperator(store, input.actorUserId)
      assertDraftShape(input.definition)
      const skillId = readSkillId(input.definition)!
      try {
        return await store.saveDraft({
          contentKey: skillId,
          contentKind: 'skill',
          definition: structuredClone(input.definition) as CombatContentDefinition,
          baseVersion: input.baseVersion,
          expectedDraftVersion: input.expectedDraftVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async publishSkill(input) {
      await authorizeOperator(store, input.actorUserId)
      const validation = validateSkillDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Skill definition.'}`,
        )
      }
      const definition = input.definition as MatureSkillDefinition
      const current = await resolver.resolveCurrentSkillDefinition(definition.id)
      const actualBaseVersion = current?.contentVersion ?? null
      if (actualBaseVersion !== input.expectedBaseVersion) {
        throw new AurevaneError(
          'STALE_VERSION',
          'Combat content changed. Refresh the authoritative version and retry.',
        )
      }

      try {
        return await store.publish({
          contentKey: definition.id,
          contentKind: 'skill',
          definition: structuredClone(definition) as unknown as CombatContentDefinition,
          expectedBaseVersion: input.expectedBaseVersion,
          actorUserId: input.actorUserId,
        })
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },

    async rollbackSkill(input) {
      await authorizeOperator(store, input.actorUserId)
      if (!Number.isSafeInteger(input.targetVersion) || input.targetVersion < 1) {
        throw new AurevaneError('INVALID_REQUEST', 'Rollback target must be a positive version.')
      }

      const target = await resolver.resolvePinnedSkillDefinition(input.skillId, input.targetVersion)
      if (!target || target.id !== input.skillId || !target.enabled) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'That rollback target is not an enabled Skill version.',
        )
      }

      const stored = (await store.listPublishedVersions(input.skillId)).some(
        (version) => version.contentVersion === input.targetVersion,
      )
      try {
        await store.setCurrentPublication(
          input.skillId,
          stored ? input.targetVersion : null,
          input.actorUserId,
        )
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },
  }
}
