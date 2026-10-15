import 'server-only'
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
    const definition = entry.category === 'essence' ? entry.definition.skill : entry.definition
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
