import { battleTextContextIssues } from '@aurevane/game-core/combat/battle-narration'
import { finalizedContentMediaIssues } from '@aurevane/game-core/combat/content-media'
import {
  validateBasicSkillDefinition,
  type BasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { isBasicSkillId } from '../combat/combat-content-published-validation'
import { validateCurrentCombatTargetAuthoring } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { validateCurrentPercentageDotAuthoring } from '@aurevane/game-core/combat/combat-percentage-dots'
import { validateCombatActionDefinition } from '@aurevane/game-core/combat/combat-authoring-validation'
import {
  validateAbilityDefinition,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import {
  hasCanonicalCleanseStatuses,
  isCleanseEffect,
} from '@aurevane/game-core/combat/combat-cleanse'
import {
  validateEssenceDefinition as validateCanonicalEssenceDefinition,
  type EssenceDefinition,
} from '@aurevane/game-core/combat/essence'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  toMaterializedCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  validateResonanceDefinition as validateCanonicalResonanceDefinition,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
import {
  normalizedResonanceMechanics,
  isResonanceDefinitionV2,
} from '@aurevane/game-core/combat/resonance-v2'
import { isRegisteredSkillAudioCueHook, isRegisteredSkillIconHook } from '@/media/skill-media-hooks'
import type {
  CombatContentValidationIssue,
  CombatContentValidationResult,
} from './combat-content-authoring-service'

const FORBIDDEN_DRAFT_FIELDS = new Set([
  'presentationTags',
  'derivedTags',
  'script',
  'sourceCode',
  'handler',
])

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readSkillId(definition: unknown): string | null {
  if (!isRecord(definition)) return null
  return typeof definition.id === 'string' && definition.id.length > 0 ? definition.id : null
}

export function readEssenceId(definition: unknown): string | null {
  if (!isRecord(definition)) return null
  return typeof definition.essenceId === 'string' && definition.essenceId.length > 0
    ? definition.essenceId
    : null
}

export function readResonanceId(definition: unknown): string | null {
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

    // Legacy activation fields retain their original actor/target/ability contract.
    // Contextual configured values and outcomes belong to the typed presentation fields.
    if ((field === 'flavorLine' || field === 'battleText') && typeof nested === 'string') {
      for (const message of battleTextContextIssues(nested, { field: 'activation' }))
        issues.push({ path: fieldPath, code: 'UNAVAILABLE_TEXT_REFERENCE', message })
    }
    if (field === 'media') {
      for (const path of finalizedContentMediaIssues(nested))
        issues.push({
          path: fieldPath + path.slice(5),
          code: 'INVALID_FINALIZED_MEDIA',
          message:
            'Choose a finalized media asset; upload tickets and URLs cannot be saved as media.',
        })
    }
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

export function draftShapeIssues(definition: unknown): CombatContentValidationIssue[] {
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

function canonicalAbilityIssues(value: unknown): CombatContentValidationIssue[] {
  return validateAbilityDefinition(value).map((issue) => ({
    path: `ability.${issue.path}`,
    code: 'INVALID_ABILITY_DEFINITION',
    message: `${issue.path}: ${issue.message}`,
  }))
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

export function validateSkillDefinition(definition: unknown): CombatContentValidationResult {
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

  if (canonical && issues.some((issue) => issue.path === 'ability'))
    issues.push(...canonicalAbilityIssues(candidate.ability))

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

export function validateEssenceAuthoringDefinition(
  definition: unknown,
): CombatContentValidationResult {
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

  if (isRecord(candidate.skill)) {
    // Include actionable nested issues even when the Essence envelope already reports skill.definition.
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

export function validateResonanceAuthoringDefinition(
  definition: unknown,
): CombatContentValidationResult {
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

  if (issues.some((issue) => issue.path === 'ability'))
    issues.push(...canonicalAbilityIssues(candidate.ability))

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
