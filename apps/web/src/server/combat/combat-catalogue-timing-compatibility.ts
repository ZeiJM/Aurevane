import 'server-only'
import { combatEffectPresentationId } from '@aurevane/game-core/combat/combat-effect-identities'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { applyAbilityTimingDefaults } from '@aurevane/game-core/combat/combat-definition'
import {
  combatActionEffectTimingTag,
  combatEffectTimingMode,
  currentCombatEffectTimingTag,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { toMaterializedCombatActionDefinition } from '@aurevane/game-core/combat/mature-skills'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import type { CombatContentCatalogue } from './combat-content-resolver'
import { AurevaneError } from '@aurevane/game-core/errors'
export interface CombatCatalogueTimingIssue {
  readonly contentKey: string
  readonly behaviorId?: string
  readonly code: 'unsupported-controlled-behavior' | 'legacy-controlled-unsupported'
}

/** Same pinned-default compiler as battle admission; native actions have no prime authority. */
export function validateCombatCatalogueTiming(
  catalogue: CombatContentCatalogue,
): readonly CombatCatalogueTimingIssue[] {
  const issues: CombatCatalogueTimingIssue[] = []
  for (const entry of catalogue.entries) {
    if (entry.category === 'status' || entry.category === 'effect-profile') continue
    if (!entry.definition.enabled) continue
    // Match Essence battle/authoring precedence without invoking runtime usability on drafts.
    const definition =
      entry.category === 'essence'
        ? Object.hasOwn(entry.definition, 'ability')
          ? { ...entry.definition.skill, ability: entry.definition.ability }
          : entry.definition.skill
        : entry.definition
    if (definition.ability) {
      for (const behavior of definition.ability.behaviors) {
        try {
          applyAbilityTimingDefaults(behavior, catalogue.policy)
        } catch {
          issues.push({
            contentKey: entry.contentKey,
            behaviorId: behavior.id,
            code: 'unsupported-controlled-behavior',
          })
        }
      }
      continue
    }
    const nativeControlled =
      entry.category === 'resonance'
        ? normalizedResonanceMechanics(entry.definition).resultEffects.some(
            (effect) =>
              combatEffectTimingMode(catalogue.policy, currentCombatEffectTimingTag(effect)) ===
              'controlled',
          )
        : entry.category !== 'basic' &&
          (['pve', 'pvp'] as const).some((context) => {
            const action = toMaterializedCombatActionDefinition(
              entry.category === 'essence' ? entry.definition.skill : entry.definition,
              context,
            )
            return action.effects.some(
              (effect, ordinal) =>
                (action.effectTimingModes?.[ordinal] ??
                  combatEffectTimingMode(
                    catalogue.policy,
                    combatActionEffectTimingTag(
                      { displacementPolicyVersion: 1 },
                      effect,
                      action.effectTimingTags?.[ordinal],
                    ),
                  )) === 'controlled',
            )
          })
    if (nativeControlled)
      issues.push({ contentKey: entry.contentKey, code: 'legacy-controlled-unsupported' })
  }
  return issues
}

export function assertCombatCatalogueTimingCompatible(catalogue: CombatContentCatalogue): void {
  const issues = validateCombatCatalogueTiming(catalogue)
  if (!issues.length) return
  const names = issues
    .slice(0, 5)
    .map((issue) =>
      issue.behaviorId ? `${issue.contentKey} (${issue.behaviorId})` : issue.contentKey,
    )
  throw new AurevaneError(
    'INVALID_REQUEST',
    `Timing is incompatible with ${names.join(', ')}${issues.length > 5 ? ` and ${issues.length - 5} more` : ''}. Use compatible captured Manual actions or explicit timing overrides before publishing.`,
  )
}

/** Informational dependencies from the exact catalogue used by the compatibility guard. */
export function combatTimingUsedBy(
  catalogue: CombatContentCatalogue,
  mode: 'timing' | 'presentation' = 'timing',
): Record<string, { contentKey: string; name: string }[]> {
  const used: Record<string, { contentKey: string; name: string }[]> = {}
  for (const entry of catalogue.entries) {
    if (
      entry.category === 'status' ||
      entry.category === 'effect-profile' ||
      !entry.definition.enabled
    )
      continue
    const definition =
      entry.category === 'essence'
        ? Object.hasOwn(entry.definition, 'ability')
          ? { ...entry.definition.skill, ability: entry.definition.ability }
          : entry.definition.skill
        : entry.definition
    const tags = new Set<string>()
    if (definition.ability) {
      for (const group of definition.ability.behaviors)
        for (const effect of group.effects) {
          if (mode === 'presentation') {
            tags.add(combatEffectPresentationId(effect.payload))
            continue
          }
          if (effect.payload.type === 'move' || effect.payload.type === 'damage-bonus') continue
          tags.add(
            effect.payload.type === 'summon'
              ? 'summon'
              : currentCombatEffectTimingTag(nativeCombatTagPayload(effect.payload)),
          )
        }
    } else if (entry.category === 'resonance') {
      for (const effect of normalizedResonanceMechanics(entry.definition).resultEffects)
        tags.add(
          mode === 'presentation'
            ? combatEffectPresentationId(effect)
            : currentCombatEffectTimingTag(effect),
        )
    } else if (entry.category !== 'basic') {
      for (const context of ['pve', 'pvp'] as const) {
        const action = toMaterializedCombatActionDefinition(
          entry.category === 'essence' ? entry.definition.skill : entry.definition,
          context,
        )
        for (const [ordinal, effect] of action.effects.entries())
          tags.add(
            mode === 'presentation'
              ? combatEffectPresentationId(effect)
              : combatActionEffectTimingTag(
                  { displacementPolicyVersion: 1 },
                  effect,
                  action.effectTimingTags?.[ordinal],
                ),
          )
      }
    }
    for (const tag of tags)
      (used[tag] ??= []).push({
        contentKey: entry.contentKey,
        name: 'name' in definition ? String(definition.name) : entry.contentKey,
      })
  }
  return used
}

export function combatEffectUsedBy(catalogue: CombatContentCatalogue) {
  return combatTimingUsedBy(catalogue, 'presentation')
}
