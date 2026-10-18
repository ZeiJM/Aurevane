import {
  defaultBasicSkills,
  validateBasicSkillDefinition,
  type BasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import {
  isBasicSkillId,
  validatePublishedBasicSkill,
} from '@/server/combat/combat-content-resolver'
import { validateCurrentCombatTargetAuthoring } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { validateCurrentPercentageDotAuthoring } from '@aurevane/game-core/combat/combat-percentage-dots'
import 'server-only'

import type {
  CombatContentDefinition,
  CombatContentDraftRecord,
  CombatContentRepository,
  CombatContentVersionRecord,
} from '@aurevane/db/combat-content'
import { CombatContentConflictError } from '@aurevane/db/combat-content'
import { validateCombatActionDefinition } from '@aurevane/game-core/combat/combat-authoring-validation'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import {
  hasCanonicalCleanseStatuses,
  isCleanseEffect,
} from '@aurevane/game-core/combat/combat-cleanse'
import {
  resolveEssenceForBuild,
  validateEssenceDefinition as validateCanonicalEssenceDefinition,
  type EssenceDefinition,
} from '@aurevane/game-core/combat/essence'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  toMaterializedCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  resolveResonanceForPair,
  validateResonanceDefinition as validateCanonicalResonanceDefinition,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
import {
  normalizedResonanceMechanics,
  isResonanceDefinitionV2,
} from '@aurevane/game-core/combat/resonance-v2'
import { AurevaneError } from '@aurevane/game-core/errors'

import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'
import { isRegisteredSkillAudioCueHook, isRegisteredSkillIconHook } from '@/media/skill-media-hooks'
import { builtinCombatContentVersionFloor } from './combat-content-version-floor'

import {
  previewCombatContentDefinition,
  previewBasicCombatContentDefinition,
  previewResonanceCombatContentDefinition,
  previewModifierCombatContentDefinition,
  previewAutomaticCombatContentDefinition,
  previewHistoricalResonanceCombatContentDefinition,
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
    if (
      ['statusId', 'statusIds', 'tag', 'requiredTags', 'excludedTags'].includes(field) &&
      (nested === 'displaced' ||
        nested === 'Displaced' ||
        (Array.isArray(nested) && nested.some((tag) => tag === 'displaced' || tag === 'Displaced')))
    )
      issues.push({
        path: fieldPath,
        code: 'RETIRED_DISPLACED_TAG',
        message: 'Displaced is retired. Use Push or Pull effects directly.',
      })

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
        path: '$',
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

function normalizeMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Combat definition is invalid.'
}

/** Called only after the actual Ability parser has accepted every group and payload. */
function canonicalCleanseIssues(definition: AbilityDefinition): CombatContentValidationIssue[] {
  return definition.behaviors.flatMap((behavior, group) =>
    behavior.effects.flatMap(({ payload }, effect) =>
      payload.type === 'remove-status' &&
      isCleanseEffect(payload) &&
      !hasCanonicalCleanseStatuses(payload.statusIds)
        ? [
            {
              path: `ability.behaviors[${group}].effects[${effect}].payload.statusIds`,
              code: 'INCONSISTENT_CLEANSE',
              message:
                'Cleanse must remove Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked and Taunted. Use the standard Cleanse list.',
            },
          ]
        : [],
    ),
  )
}

function validateSkillDefinition(definition: unknown): CombatContentValidationResult {
  const issues = draftShapeIssues(definition)
  if (!isRecord(definition) || issues.length > 0) {
    return { valid: false, issues, derivedTags: [] }
  }

  if (isBasicSkillId(readSkillId(definition)!)) {
    issues.push(...validateBasicSkillDefinition(definition))
    const basic = definition as unknown as BasicSkillDefinition
    if (!issues.length) issues.push(...canonicalCleanseIssues(basic.ability))
    if (!issues.length) {
      if (!isRegisteredSkillIconHook(basic.media.iconKey))
        issues.push({
          path: 'media.iconKey',
          code: 'UNKNOWN_MEDIA_HOOK',
          message: 'Basic Skill artwork must use a registered media hook.',
        })
      if (!isRegisteredSkillAudioCueHook(basic.media.audioCueKey))
        issues.push({
          path: 'media.audioCueKey',
          code: 'UNKNOWN_MEDIA_HOOK',
          message: 'Basic Skill audio must use a registered media hook.',
        })
    }
    return { valid: !issues.length, issues, derivedTags: issues.length ? [] : [...basic.tags] }
  }
  const candidate = structuredClone(definition) as unknown as MatureSkillDefinition
  const canonical = Object.hasOwn(candidate, 'ability')
  try {
    if (!canonical) {
      validateCurrentCombatTargetAuthoring(candidate)
      validateCurrentPercentageDotAuthoring(candidate)
    }
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
    if (canonical) issues.push(...canonicalCleanseIssues(candidate.ability!))
    else
      for (const [index, effect] of candidate.effects.entries()) {
        if (isCleanseEffect(effect) && !hasCanonicalCleanseStatuses(effect.statusIds)) {
          issues.push({
            path: `effects[${index}].statusIds`,
            code: 'INCONSISTENT_CLEANSE',
            message:
              'Cleanse must remove Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked and Taunted. Use the standard Cleanse list.',
          })
        }
      }
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

  if (issues.length === 0 && !canonical) {
    for (const context of ['pve', 'pvp'] as const) {
      try {
        const action = toMaterializedCombatActionDefinition(candidate, context)
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
      derivedTags: combatActionPresentationTags(candidate),
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
      path: '$',
      code: 'INVALID_ESSENCE_SHAPE',
      message: normalizeMessage(error),
    })
  }

  if (issues.length === 0) {
    // Authoring permits disabled versions; runtime usability is a separate gate.
    const skillValidation = validateSkillDefinition(
      Object.hasOwn(candidate, 'ability')
        ? { ...candidate.skill, ability: candidate.ability }
        : candidate.skill,
    )
    for (const issue of skillValidation.issues) {
      issues.push({
        ...issue,
        path:
          candidate.ability && issue.path.startsWith('ability.')
            ? issue.path
            : `skill.${issue.path}`,
      })
    }
  }
  if (issues.length > 0) return { valid: false, issues, derivedTags: [] }

  return {
    valid: true,
    issues: [],
    derivedTags: combatActionPresentationTags(candidate.skill),
  }
}

function validateResonanceAuthoringDefinition(definition: unknown): CombatContentValidationResult {
  const issues = draftShapeIssuesForIdentity(definition, 'id', 'Resonance')
  if (!isRecord(definition) || issues.length > 0) {
    return { valid: false, issues, derivedTags: [] }
  }

  const candidate = structuredClone(definition) as unknown as AnyResonanceDefinition
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
      path: '$',
      code: 'INVALID_RESONANCE_SHAPE',
      message: normalizeMessage(error),
    })
  }

  if (issues.length === 0) {
    if (candidate.ability) issues.push(...canonicalCleanseIssues(candidate.ability))
    else
      for (const [index, effect] of normalizedResonanceMechanics(
        candidate,
      ).resultEffects.entries()) {
        if (isCleanseEffect(effect) && !hasCanonicalCleanseStatuses(effect.statusIds)) {
          issues.push({
            path: `trigger.${isResonanceDefinitionV2(candidate) ? 'resultEffects' : 'payoffEffects'}[${index}].statusIds`,
            code: 'INCONSISTENT_CLEANSE',
            message:
              'Cleanse must remove Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked and Taunted. Use the standard Cleanse list.',
          })
        }
      }
  }
  return { valid: issues.length === 0, issues, derivedTags: [] }
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
