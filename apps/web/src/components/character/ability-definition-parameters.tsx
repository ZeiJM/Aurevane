'use client'

import type { BasicSkillDefinition } from '@aurevane/game-core/combat/combat-basic-actions'
import type { BasicActionCharacterStats } from './basic-action-presentation'
import type { PublicAbilityDefinition } from '@aurevane/game-core/combat/public-combat-presentation'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { AbilityParameters } from './ability-parameters'
import {
  useSkillEffectTimingPolicy,
  useSkillGroundInteractionRules,
  useSkillDotTriggerPolicyVersion,
} from './skill-effect-timing-context'
import styles from './ability-definition-parameters.module.css'

/** Current/draft/exact-pinned definitions share the captured report grammar, one report per group. */
export function AbilityDefinitionParameters({
  definition,
  basic,
  stats,
  effectDescriptions,
  characteristicsClassName,
  effectExplanationsClassName,
  showActivationNotes = true,
}: {
  definition: PublicAbilityDefinition
  basic?: BasicSkillDefinition
  stats?: BasicActionCharacterStats
  effectDescriptions?: readonly (string | null)[]
  characteristicsClassName?: string
  effectExplanationsClassName?: string
  showActivationNotes?: boolean
}) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const groundRules = useSkillGroundInteractionRules()
  const dotPolicy = useSkillDotTriggerPolicyVersion()
  const authored =
    effectDescriptions?.length ===
    definition.behaviors.reduce((sum, behavior) => sum + behavior.effects.length, 0)
      ? effectDescriptions
      : undefined
  return (
    <div data-ability-definition-parameters="true">
      {definition.behaviors.map((behavior, index) => {
        const offset = definition.behaviors
          .slice(0, index)
          .reduce((sum, group) => sum + group.effects.length, 0)
        const explanations = authored?.slice(offset, offset + behavior.effects.length)
        const report = abilityBehaviorInformation(behavior, {
          tagPresentation: definition.tagPresentation,
          basic,
          stats,
          timingPolicy,
          effectContext: {
            ...groundRules,
            legacyTriggers: dotPolicy === null,
            legacyPoisonMovement: dotPolicy !== 2,
          },
        })
        const label = `${behavior.activation === 'manual' ? 'Manual' : behavior.activation === 'automatic' ? 'Automatic' : 'Ongoing'} ${behavior.mode === 'action' ? 'Action' : 'Modifier'}${definition.behaviors.length > 1 ? ` ${index + 1}` : ''}`
        return (
          <section
            className={styles.group}
            aria-label={label}
            data-ability-behavior={behavior.id}
            key={behavior.id}
          >
            {definition.behaviors.length > 1 ? <h4 className={styles.heading}>{label}</h4> : null}
            <AbilityParameters
              report={{
                ...report,
                effects: report.effects.map((effect, effectIndex) => {
                  if (effect.tagPresentation || explanations?.[effectIndex] == null) return effect
                  const { explanationParts: _generated, ...authoredEffect } = effect
                  void _generated
                  return authoredEffect
                }),
                effectDescriptions: report.effectDescriptions.map((fallback, effectIndex) =>
                  report.effects[effectIndex]?.tagPresentation
                    ? fallback
                    : (explanations?.[effectIndex] ?? fallback),
                ),
              }}
              characteristicsClassName={characteristicsClassName}
              effectExplanationsClassName={effectExplanationsClassName}
              showActivationNotes={showActivationNotes}
            />
          </section>
        )
      })}
    </div>
  )
}
