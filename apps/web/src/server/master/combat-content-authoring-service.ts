import 'server-only'

import type {
  CombatContentDefinition,
  CombatContentDraftRecord,
  CombatContentRepository,
  CombatContentVersionRecord,
} from '@aurevane/db/combat-content'
import { CombatContentConflictError } from '@aurevane/db/combat-content'
import { validateCombatActionDefinition } from '@aurevane/game-core/combat/combat-authoring-validation'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  toCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import { AurevaneError } from '@aurevane/game-core/errors'

import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'

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

export interface CombatContentSkillAuthoringState {
  readonly skillId: string
  readonly currentSource: 'static' | 'published'
  readonly baseVersion: number
  readonly currentDefinition: MatureSkillDefinition
  readonly draft: CombatContentDraftRecord | null
  readonly publishedVersions: readonly CombatContentVersionRecord[]
  readonly validation: CombatContentValidationResult
  readonly diff: CombatContentSemanticDiff
  readonly draftIsStale: boolean
}

export interface CombatContentAuthoringService {
  requireOperator(actorUserId: string): Promise<MasterPanelOperatorRole>
  validateSkillDefinition(definition: unknown): CombatContentValidationResult
  previewSkillDefinition(input: {
    actorUserId: string
    definition: unknown
    seed?: number
    combatContext?: MatureSkillCombatContext
  }): Promise<CombatContentPreviewResult>
  diffSkillDefinitions(before: unknown, after: unknown): CombatContentSemanticDiff
  loadSkillAuthoringState(input: {
    actorUserId: string
    skillId: string
  }): Promise<CombatContentSkillAuthoringState>
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

  const issues: CombatContentValidationIssue[] = []
  for (const field of FORBIDDEN_DRAFT_FIELDS) {
    if (Object.hasOwn(definition, field)) {
      issues.push({
        path: field,
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
  }
  if (!readSkillId(definition)) {
    issues.push({ path: 'id', code: 'INVALID_SKILL_ID', message: 'Skill id is required.' })
  }
  return issues
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
    for (const context of ['pve', 'pvp'] as const) {
      try {
        const action = toCombatActionDefinition(candidate, context)
        for (const issue of validateCombatActionDefinition(action)) {
          issues.push({
            path: `${context}.${issue.field}`,
            code: 'INVALID_COMBAT_ACTION',
            message: issue.message,
          })
        }
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
    throw new AurevaneError('FORBIDDEN', 'Master Panel combat authoring is not available to this account.')
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

    async loadSkillAuthoringState(input) {
      await authorizeOperator(store, input.actorUserId)
      if (!input.skillId || input.skillId.trim() !== input.skillId) {
        throw new AurevaneError('INVALID_REQUEST', 'Skill id must be a non-empty canonical id.')
      }

      const [currentDefinition, published, draft, publishedVersions] = await Promise.all([
        resolver.resolveCurrentSkillDefinition(input.skillId),
        store.findPublished(input.skillId),
        store.findDraft(input.skillId),
        store.listPublishedVersions(input.skillId),
      ])

      if (
        !currentDefinition ||
        currentDefinition.id !== input.skillId ||
        !currentDefinition.enabled
      ) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'That Skill does not have an enabled current definition.',
        )
      }

      const editableDefinition = draft?.definition ?? currentDefinition
      return {
        skillId: input.skillId,
        currentSource: published ? 'published' : 'static',
        baseVersion: currentDefinition.contentVersion,
        currentDefinition: structuredClone(currentDefinition),
        draft: draft
          ? {
              ...draft,
              definition: structuredClone(draft.definition),
            }
          : null,
        publishedVersions: publishedVersions.map((version) => ({
          ...version,
          definition: structuredClone(version.definition),
        })),
        validation: validateSkillDefinition(editableDefinition),
        diff: {
          changedPaths: draft
            ? semanticChangedPaths(currentDefinition, draft.definition)
            : [],
        },
        draftIsStale:
          draft !== null && draft.baseVersion !== currentDefinition.contentVersion,
      }
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
        throw new AurevaneError('INVALID_REQUEST', 'That rollback target is not an enabled Skill version.')
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
