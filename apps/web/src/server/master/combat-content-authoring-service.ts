import {
  isBasicSkillId,
  validatePublishedBasicSkill,
} from '@/server/combat/combat-content-resolver'
import {
  defaultBasicSkills,
  type BasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import 'server-only'
import {
  draftShapeIssues,
  isRecord,
  readEssenceId,
  readResonanceId,
  readSkillId,
  validateEssenceAuthoringDefinition,
  validateResonanceAuthoringDefinition,
  validateSkillDefinition,
} from './combat-content-authoring-validation'

import type {
  CombatContentDefinition,
  CombatContentDraftRecord,
  CombatContentRepository,
  CombatContentVersionRecord,
} from '@aurevane/db/combat-content'
import { CombatContentConflictError } from '@aurevane/db/combat-content'
import { resolveEssenceForBuild, type EssenceDefinition } from '@aurevane/game-core/combat/essence'
import {
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  resolveResonanceForPair,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import { AurevaneError } from '@aurevane/game-core/errors'

import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'
import { builtinCombatContentVersionFloor } from './combat-content-version-floor'

import {
  previewAutomaticCombatContentDefinition,
  previewBasicCombatContentDefinition,
  previewCombatContentDefinition,
  previewHistoricalResonanceCombatContentDefinition,
  previewModifierCombatContentDefinition,
  previewResonanceCombatContentDefinition,
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
  recordCommand?(input: unknown): Promise<unknown>
  requireOperator(actorUserId: string): Promise<MasterPanelOperatorRole>
  validateSkillDefinition(definition: unknown): CombatContentValidationResult
  validateEssenceDefinition(definition: unknown): CombatContentValidationResult
  validateResonanceDefinition(definition: unknown): CombatContentValidationResult
  previewSkillDefinition(input: {
    contentKind?: 'skill' | 'resonance'
    actorUserId: string
    definition: unknown
    behaviorId?: string
    previewSetupSkillId?: string
    previewRootSkillId?: string
    previewRootBehaviorId?: string
    eventSample?: import('@/components/master/combat-content/combat-content-workflow').CombatContentEventSample
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
  restoreBasicSkillDraft(input: {
    actorUserId: string
    skillId: string
    targetVersion: number
    expectedBaseVersion: number
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
      const catalogue = await resolver.captureCurrentCatalogue?.()
      const previewResolver = catalogue?.resolver ?? resolver
      const resonance = input.contentKind === 'resonance'
      const validation = resonance
        ? validateResonanceAuthoringDefinition(input.definition)
        : validateSkillDefinition(input.definition)
      if (!validation.valid) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Combat content validation failed: ${validation.issues[0]?.message ?? 'invalid Skill definition.'}`,
        )
      }

      const definition = input.definition as
        MatureSkillDefinition | BasicSkillDefinition | AnyResonanceDefinition
      if (resonance && !definition.enabled)
        throw new AurevaneError('INVALID_REQUEST', 'That Resonance version is disabled.')
      if (resonance && !Object.hasOwn(definition, 'ability')) {
        if (!input.previewRootSkillId)
          throw new AurevaneError(
            'INVALID_REQUEST',
            'This Resonance has no Manual action group to simulate. Choose native reference Skills for a historical sample.',
          )
        if (input.behaviorId !== undefined || input.previewRootBehaviorId !== undefined)
          throw new AurevaneError(
            'INVALID_REQUEST',
            'Historical samples have no selectable behavior group.',
          )
        const historical = definition as AnyResonanceDefinition
        const mechanics = normalizedResonanceMechanics(historical)
        if (
          mechanics.mode === 'sequence'
            ? !input.previewSetupSkillId
            : input.previewSetupSkillId !== undefined
        )
          throw new AurevaneError(
            'INVALID_REQUEST',
            'Choose a setup Skill for sequence samples only.',
          )
        const resolveReference = async (id: string) => {
          const skill = await previewResolver.resolveCurrentSkillDefinition(id)
          if (!skill?.enabled || Object.hasOwn(skill, 'ability'))
            throw new AurevaneError(
              'INVALID_REQUEST',
              'Choose an enabled native reference Skill for this historical sample.',
            )
          return skill
        }
        const trigger = await resolveReference(input.previewRootSkillId)
        const setup =
          input.previewSetupSkillId === undefined
            ? undefined
            : await resolveReference(input.previewSetupSkillId)
        return previewHistoricalResonanceCombatContentDefinition(historical, trigger, {
          ...(catalogue ? { effectTimingPolicy: catalogue.policy } : {}),
          ...(setup ? { setup } : {}),
          ...(input.seed === undefined ? {} : { seed: input.seed }),
          ...(input.combatContext === undefined ? {} : { combatContext: input.combatContext }),
        })
      }
      let behaviorId: string | undefined
      if (Object.hasOwn(definition, 'ability')) {
        const actions = definition.ability!.behaviors.filter(
          (behavior) =>
            behavior.activation === 'manual' ||
            (behavior.activation === 'automatic' && behavior.mode === 'action') ||
            (behavior.activation === 'ongoing' && behavior.mode === 'modifier'),
        )
        const selected =
          input.behaviorId !== undefined
            ? actions.find((behavior) => behavior.id === input.behaviorId)
            : actions.length === 1
              ? actions[0]
              : undefined
        if (!selected)
          throw new AurevaneError(
            'INVALID_REQUEST',
            actions.length === 0
              ? 'This definition has no Manual action group to simulate.'
              : 'Choose a supported Manual action group to preview.',
          )
        behaviorId = selected.id
        if (selected.mode === 'modifier' || selected.activation === 'automatic') {
          if (!definition.enabled)
            throw new AurevaneError('INVALID_REQUEST', 'That modifier version is disabled.')
          const rootId = input.previewRootSkillId ?? 'unarmed.basic'
          if (rootId === definition.id)
            throw new AurevaneError('INVALID_REQUEST', 'Choose a separate reference action.')
          const root = isBasicSkillId(rootId)
            ? ((await previewResolver.resolveCurrentBasicSkillDefinitions?.([rootId]))?.get(
                rootId,
              ) ??
              defaultBasicSkills().find((row) => row.id === rootId) ??
              null)
            : await previewResolver.resolveCurrentSkillDefinition(rootId)
          const rootActions =
            root?.ability?.behaviors.filter(
              (row) => row.activation === 'manual' && row.mode === 'action',
            ) ?? []
          const rootBehavior =
            input.previewRootBehaviorId !== undefined
              ? rootActions.find((row) => row.id === input.previewRootBehaviorId)
              : rootActions.length === 1
                ? rootActions[0]
                : undefined
          if (
            !root?.enabled ||
            (Object.hasOwn(root, 'ability')
              ? !rootBehavior
              : input.previewRootBehaviorId !== undefined)
          )
            throw new AurevaneError(
              'INVALID_REQUEST',
              'Choose an enabled reference action and an unambiguous Manual action group.',
            )
          const preview =
            selected.activation === 'automatic'
              ? previewAutomaticCombatContentDefinition
              : previewModifierCombatContentDefinition
          return preview(definition as MatureSkillDefinition | AnyResonanceDefinition, root, {
            behaviorId,
            ...(catalogue ? { effectTimingPolicy: catalogue.policy } : {}),
            ...(rootBehavior ? { rootBehaviorId: rootBehavior.id } : {}),
            ...(input.seed === undefined ? {} : { seed: input.seed }),
            ...(input.combatContext === undefined ? {} : { combatContext: input.combatContext }),
            ...(input.eventSample === undefined ? {} : { eventSample: input.eventSample }),
          })
        }
      } else if (input.behaviorId !== undefined) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'This native definition has no selectable behavior group.',
        )
      }
      const options = {
        ...(catalogue ? { effectTimingPolicy: catalogue.policy } : {}),
        ...(behaviorId === undefined ? {} : { behaviorId }),
        ...(input.seed === undefined ? {} : { seed: input.seed }),
        ...(input.combatContext === undefined ? {} : { combatContext: input.combatContext }),
      }
      if (resonance)
        return previewResonanceCombatContentDefinition(
          definition as AnyResonanceDefinition,
          options,
        )
      return isBasicSkillId(definition.id)
        ? previewBasicCombatContentDefinition(definition as BasicSkillDefinition, options)
        : previewCombatContentDefinition(definition as MatureSkillDefinition, options)
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

    async restoreBasicSkillDraft(input) {
      await authorizeOperator(store, input.actorUserId)
      if (
        !isBasicSkillId(input.skillId) ||
        !Number.isSafeInteger(input.targetVersion) ||
        input.targetVersion < 1 ||
        !Number.isSafeInteger(input.expectedBaseVersion) ||
        input.expectedBaseVersion < 1 ||
        (input.expectedDraftVersion !== null &&
          (!Number.isSafeInteger(input.expectedDraftVersion) || input.expectedDraftVersion < 1))
      ) {
        throw new AurevaneError('INVALID_REQUEST', 'Choose a Basic Skill and valid versions.')
      }
      const [published, history] = await Promise.all([
        store.findPublished(input.skillId),
        store.listPublishedVersions(input.skillId),
      ])
      const builtin = defaultBasicSkills().find((row) => row.id === input.skillId)!
      const readStoredVersion = (record: CombatContentVersionRecord, version?: number) => {
        try {
          return validatePublishedBasicSkill(record, builtin.id, version)
        } catch (error) {
          throw new AurevaneError(
            'PERSISTENCE_UNAVAILABLE',
            'Basic Skill history is unavailable. Refresh and retry.',
            { cause: error },
          )
        }
      }
      const current = published ? readStoredVersion(published) : builtin
      if (current.contentVersion !== input.expectedBaseVersion) {
        throw new AurevaneError(
          'STALE_VERSION',
          'Combat content changed. Refresh the authoritative version and retry.',
        )
      }
      const matches = history.filter((row) => row.contentVersion === input.targetVersion)
      if (matches.length > 1) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'Basic Skill history contains an ambiguous version.',
        )
      }
      const target = matches[0]
        ? readStoredVersion(matches[0], input.targetVersion)
        : builtin.contentVersion === input.targetVersion
          ? builtin
          : null
      if (!target) {
        throw new AurevaneError('INVALID_REQUEST', 'That Basic Skill version is unavailable.')
      }
      try {
        // Draft-only operation: publication still performs its own current-base/catalogue CAS.
        return await store.saveDraft({
          contentKey: input.skillId,
          contentKind: 'skill',
          definition: structuredClone(target) as unknown as CombatContentDefinition,
          baseVersion: current.contentVersion,
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
      const definition = input.definition as MatureSkillDefinition | BasicSkillDefinition
      const basic = isBasicSkillId(definition.id)
      const publishedBasic = basic ? await store.findPublished(definition.id) : null
      const current = basic
        ? publishedBasic
          ? validatePublishedBasicSkill(publishedBasic, definition.id as BasicSkillDefinition['id'])
          : defaultBasicSkills().find((row) => row.id === definition.id)
        : await resolver.resolveCurrentSkillDefinition(definition.id)
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
          versionFloor: builtinCombatContentVersionFloor('skill', definition.id),
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

      const basic = isBasicSkillId(input.skillId)
      const basicVersion = basic
        ? (await store.listPublishedVersions(input.skillId)).find(
            (row) => row.contentVersion === input.targetVersion,
          )
        : null
      const target = basic
        ? basicVersion
          ? validatePublishedBasicSkill(
              basicVersion,
              input.skillId as BasicSkillDefinition['id'],
              input.targetVersion,
            )
          : defaultBasicSkills().find(
              (row) => row.id === input.skillId && row.contentVersion === input.targetVersion,
            )
        : await resolver.resolvePinnedSkillDefinition(input.skillId, input.targetVersion)
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
      const published = await store.findPublished(definition.essenceId, 'essence')
      if (published && published.contentKind !== 'essence') {
        throw new AurevaneError('INVALID_REQUEST', 'Combat content kind conflict.')
      }
      const fallback = published
        ? null
        : resolveEssenceForBuild(definition.sourceDisciplineId, null)
      const actualBaseVersion =
        published?.contentVersion ??
        (fallback?.essenceId === definition.essenceId ? fallback.contentVersion : null)
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
          versionFloor: builtinCombatContentVersionFloor('essence', definition.essenceId),
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
      if (!stored && (!fallback || fallback.essenceId !== input.essenceId || !fallback.enabled)) {
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
          'essence',
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
      const definition = input.definition as AnyResonanceDefinition
      const published = await store.findPublished(definition.id, 'resonance')
      if (published && published.contentKind !== 'resonance') {
        throw new AurevaneError('INVALID_REQUEST', 'Combat content kind conflict.')
      }
      const fallback = published
        ? null
        : resolveResonanceForPair(definition.disciplinePair[0], definition.disciplinePair[1])
      const actualBaseVersion =
        published?.contentVersion ??
        (fallback?.id === definition.id ? fallback.contentVersion : null)
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
          versionFloor: builtinCombatContentVersionFloor('resonance', definition.id),
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
          'resonance',
        )
      } catch (error) {
        return mapRepositoryConflict(error)
      }
    },
  }
}
