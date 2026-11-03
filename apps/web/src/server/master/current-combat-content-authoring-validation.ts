import { currentEffectRequirementIssues } from '@/lib/combat-whole-requirements'
import { combatCategoryForAuthoring, combatCategoryIssues } from '@/lib/combat-category-authoring'
import type { CombatContentKind } from '@aurevane/db/combat-content'
import {
  automaticDamageDefinitionIssues,
  combatDamageForAuthoring,
} from '@/lib/combat-damage-authoring'
import {
  validateSkillDefinition as validateHistoricalSkill,
  validateEssenceAuthoringDefinition as validateHistoricalEssence,
  validateResonanceAuthoringDefinition as validateHistoricalResonance,
} from './combat-content-authoring-validation'
import type { CombatContentValidationResult } from './combat-content-authoring-service'
import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import { hasGroundAuthoringEffects } from '@/lib/combat-ground-entry-authoring'
import {
  nativeCombatTagPayload,
  type CombatTagPayload,
} from '@aurevane/game-core/combat/combat-tag-registry'
import { canonicalAbilityTargetSpec } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { isCombatGroundEntryEffect } from '@aurevane/game-core/combat/combat-ground-areas'
import { currentEffectSourceAllowed } from '@/lib/combat-exclusive-source-authoring'

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

function exclusiveSupportIssues(kind: CombatContentKind, definition: unknown) {
  const issues: CombatContentValidationResult['issues'][number][] = []
  const contentId =
    kind === 'skill' && object(definition) && typeof definition.id === 'string'
      ? definition.id
      : undefined
  if (contentId === 'basic.guard')
    issues.push({
      path: 'id',
      code: 'RETIRED_BASIC_ACTION',
      message: 'Guard is retired as a Support Action. Its Guarded effect remains available.',
    })
  function visit(value: unknown, path: string) {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`))
      return
    }
    if (!object(value)) return
    if (
      (typeof value.type === 'string' && !currentEffectSourceAllowed(value.type, contentId)) ||
      (object(value.summonProfile) && !currentEffectSourceAllowed('summon', contentId))
    ) {
      const summon = value.type === 'summon' || object(value.summonProfile)
      issues.push({
        path,
        code: 'EXCLUSIVE_SUPPORT_EFFECT',
        message: summon
          ? 'Summon belongs to Invocation. Choose another effect for this current source.'
          : 'Loot belongs to Pilfer. Choose another effect for this current source.',
      })
    }
    for (const [key, entry] of Object.entries(value)) visit(entry, path ? `${path}.${key}` : key)
  }
  visit(definition, '')
  return issues
}

/** A current Ground choice cannot silently commit the old one-shot unit delivery. */
function groundAuthoringIssues(kind: CombatContentKind, definition: unknown) {
  const issues: CombatContentValidationResult['issues'][number][] = []
  const owner =
    object(definition) && kind === 'essence' && !Object.hasOwn(definition, 'ability')
      ? definition.skill
      : definition
  function visit(container: unknown, path: string, canonical = false, depth = 0) {
    if (!object(container) || depth > 16 || !Array.isArray(container.effects)) return
    const payloads = container.effects.flatMap((row) =>
      object(row) ? (canonical ? (object(row.payload) ? [row.payload] : []) : [row]) : [],
    )
    const rawTarget = canonical ? container.targeting : container.target
    if (object(rawTarget)) {
      try {
        const target = canonical
          ? canonicalAbilityTargetSpec(rawTarget as unknown as CombatTargetSpec)
          : (rawTarget as unknown as CombatTargetSpec)
        const effects = payloads.flatMap((payload) =>
          typeof payload.type === 'string' && typeof payload.recipient === 'string'
            ? [
                canonical
                  ? nativeCombatTagPayload(payload as unknown as CombatTagPayload)
                  : (payload as unknown as CombatTagPayload),
              ]
            : [],
        )
        if (
          hasGroundAuthoringEffects(target, effects) &&
          (!object(container.groundArea) ||
            target.categories?.some((category) => category !== 'ground'))
        )
          issues.push({
            path: `${path}.groundArea`,
            code: 'GROUND_PERSISTENCE',
            message:
              'Ground effects need a Ground-only target group with persistent Ground settings. Keep Self effects in this group, and move independently targeted unit effects into a separate group.',
          })
      } catch {
        // The ordinary strict validator reports malformed or unsupported payloads.
      }
    }
    for (const [index, payload] of payloads.entries())
      if (payload.type === 'summon')
        visitSummon(payload.profile, `${path}.effects[${index}].profile`, depth + 1)
  }
  function visitSummon(profile: unknown, path: string, depth = 0) {
    if (object(profile) && Array.isArray(profile.abilities))
      profile.abilities.forEach((ability, index) =>
        visit(ability, `${path}.abilities[${index}]`, false, depth),
      )
  }
  if (object(owner)) {
    if (object(owner.ability) && Array.isArray(owner.ability.behaviors))
      owner.ability.behaviors.forEach((behavior, index) =>
        visit(behavior, `ability.behaviors[${index}]`, true),
      )
    else visit(owner, 'skill')
    if (kind === 'resonance' && !object(owner.ability) && object(owner.trigger)) {
      for (const key of ['resultEffects', 'payoffEffects']) {
        const effects = owner.trigger[key]
        if (!Array.isArray(effects)) continue
        if (
          effects.some(
            (effect) =>
              object(effect) &&
              effect.target === 'ground' &&
              typeof effect.type === 'string' &&
              typeof effect.recipient === 'string' &&
              isCombatGroundEntryEffect(effect as unknown as { type: string; recipient: string }),
          )
        )
          issues.push({
            path: `trigger.${key}`,
            code: 'GROUND_PERSISTENCE',
            message:
              'Ground effects need a Ground-only target group with persistent Ground settings. Enable the full effect editor before committing these Ground effects.',
          })
        effects.forEach((effect, index) => {
          if (object(effect) && effect.type === 'summon')
            visitSummon(effect.profile, `trigger.${key}[${index}].profile`)
        })
      }
    }
    visitSummon(owner.summonProfile, 'summonProfile')
  }
  return issues
}

/** Current editable requests add authoring rules; immutable cohort/capture validators stay exact. */
export function validateCurrentCombatContent(
  kind: CombatContentKind,
  definition: unknown,
  validate: (value: unknown) => CombatContentValidationResult,
): CombatContentValidationResult {
  const projected = combatCategoryForAuthoring(kind, combatDamageForAuthoring(kind, definition))
  const result = validate(projected)
  const issues = [
    ...result.issues,
    ...currentEffectRequirementIssues(projected),
    ...automaticDamageDefinitionIssues(kind, projected),
    ...combatCategoryIssues(kind, projected),
    ...groundAuthoringIssues(kind, projected),
    ...exclusiveSupportIssues(kind, projected),
  ]
  return { ...result, valid: result.valid && !issues.length, issues }
}
export const validateSkillDefinition = (definition: unknown) =>
  validateCurrentCombatContent('skill', definition, validateHistoricalSkill)
export const validateEssenceAuthoringDefinition = (definition: unknown) =>
  validateCurrentCombatContent('essence', definition, validateHistoricalEssence)
export const validateResonanceAuthoringDefinition = (definition: unknown) =>
  validateCurrentCombatContent('resonance', definition, validateHistoricalResonance)
