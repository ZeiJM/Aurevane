'use client'

import { effectExplanationIdentity } from './effect-explanation-identity'
import { AbilityEffectExplanations } from './ability-effect-explanations'
import {
  currentGroundBehaviorPresentation,
  currentGroundNote,
} from '@/lib/combat-ground-presentation'

import type { BasicSkillDefinition } from '@aurevane/game-core/combat/combat-basic-actions'
import type { BasicActionCharacterStats } from './basic-action-presentation'
import type { PublicAbilityDefinition } from '@aurevane/game-core/combat/public-combat-presentation'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { AbilityParameters } from './ability-parameters'
import { withCurrentAttackRuleHelp } from './skill-effect-preview'
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
  const noteVariants = new Map<string, Set<string | null>>()
  let noteOrdinal = 0
  for (const behavior of definition.behaviors)
    for (const effect of behavior.effects) {
      const identity = effectExplanationIdentity(effect.payload)
      const notes = noteVariants.get(identity) ?? new Set<string | null>()
      notes.add(authored?.[noteOrdinal++]?.trim() || null)
      noteVariants.set(identity, notes)
    }
  const groups = definition.behaviors.map((behavior, index) => {
    const offset = definition.behaviors
      .slice(0, index)
      .reduce((sum, group) => sum + group.effects.length, 0)
    const savedRuleHelp = (effectIndex: number, wording: string) => {
      const payload = behavior.effects[effectIndex]!.payload
      return payload.type === 'pierce' ||
        payload.type === 'weak-point' ||
        payload.type === 'spike' ||
        payload.type === 'ruin'
        ? withCurrentAttackRuleHelp(
            payload,
            groundRules,
            wording,
            report.effectDescriptions[effectIndex],
          )
        : wording
    }
    const savedExplanations = authored?.slice(offset, offset + behavior.effects.length)
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
    const groundPresentation = currentGroundBehaviorPresentation(
      behavior,
      groundRules.groundContactPolicyVersion,
      timingPolicy,
    )
    const explanations =
      savedExplanations &&
      groundPresentation.sourceOrdinals.map((ordinal) => {
        const wording = savedExplanations[ordinal]
        if (wording == null) return wording
        if (
          groundRules.groundContactPolicyVersion === 1 &&
          (behavior.effects[ordinal]!.payload.type === 'create-terrain' ||
            groundPresentation.fieldOrdinals.has(ordinal))
        )
          return currentGroundNote(wording, behavior.effects[ordinal]!.payload)
        return savedRuleHelp(ordinal, wording)
      })
    const label = `${behavior.activation === 'manual' ? 'Manual' : behavior.activation === 'automatic' ? 'Automatic' : 'Ongoing'} ${behavior.mode === 'action' ? 'Action' : 'Modifier'}${definition.behaviors.length > 1 ? ` ${index + 1}` : ''}`
    return {
      behavior,
      label,
      report: {
        ...report,
        effects: report.effects.map((effect, effectIndex) => {
          if (explanations?.[effectIndex] == null) return effect
          if (effect.tagPresentation)
            return (noteVariants.get(effect.explanationTagId ?? '')?.size ?? 0) > 1
              ? { ...effect, explanationAdditionalNotes: [explanations[effectIndex]!] }
              : effect
          const { explanationParts: _generated, ...authoredEffect } = effect
          void _generated
          return {
            ...authoredEffect,
            explanationBaseDescription: explanations![effectIndex]!,
            explanationBaseParts: undefined,
            explanationParts: effect.condition
              ? [
                  explanations![effectIndex]!,
                  ' Applies only when ',
                  ...(effect.conditionParts ?? [effect.condition]),
                  '.',
                ]
              : undefined,
          }
        }),
        effectDescriptions: report.effectDescriptions.map((fallback, effectIndex) =>
          report.effects[effectIndex]?.tagPresentation
            ? fallback
            : explanations?.[effectIndex] == null
              ? fallback
              : `${explanations[effectIndex]}${report.effects[effectIndex]?.condition ? ` Applies only when ${report.effects[effectIndex]!.condition}.` : ''}`,
        ),
      },
    }
  })
  return (
    <div data-ability-definition-parameters="true">
      {groups.map(({ behavior, label, report }) => (
        <section
          className={styles.group}
          aria-label={label}
          data-ability-behavior={behavior.id}
          key={behavior.id}
        >
          {definition.behaviors.length > 1 ? <h4 className={styles.heading}>{label}</h4> : null}
          <AbilityParameters
            report={report}
            characteristicsClassName={characteristicsClassName}
            showActivationNotes={showActivationNotes}
            showEffectExplanations={false}
          />
        </section>
      ))}
      <AbilityEffectExplanations
        reports={groups.map(({ report }) => report)}
        className={effectExplanationsClassName}
      />
    </div>
  )
}
