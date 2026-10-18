'use client'

import { groupSkillEffects } from '../character/skill-effect-groups'

import { skillTargetMethodExplanation } from '../character/skill-detail-presentation'
import {
  useSkillGroundInteractionRules,
  useAirborneAttackElevation,
  useSkillEffectTimingPolicy,
  useSkillDotTriggerPolicyVersion,
} from '../character/skill-effect-timing-context'
import {
  CompactSkillEffectSummary,
  EffectTagLabel,
} from '../character/compact-skill-effect-summary'
import { battleSkillParameterRows } from './battle-preview-content'
import { skillPreviewEffects } from '../character/skill-effect-preview'
import { SkillGroundAreaDetails } from '../character/skill-ground-area-details'
import type { BattleSkillForecastPresentation } from './battle-runtime'
import { SkillCharacteristicRows } from '../character/skill-characteristic-rows'
import { AbilityParameters } from '../character/ability-parameters'
import { AbilityDefinitionParameters } from '../character/ability-definition-parameters'
import { MINIMUM_SKILL_INFORMATION_FIELDS } from '../character/skill-information-contract'
import type { BattleAbilityBehaviorReport } from '@/lib/battle/battle-basic-actions'

/** Uses the same pinned definitions and parameter/effect renderers as Skill Management. */
export function BattleSkillParameters({
  skill,
  costLabel,
  cooldownLabel,
  capturedReport,
}: {
  skill: BattleSkillForecastPresentation
  costLabel?: string
  cooldownLabel?: string
  capturedReport?: BattleAbilityBehaviorReport | null
}) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const groundRules = useSkillGroundInteractionRules()
  const airborneAttackElevation = useAirborneAttackElevation()
  const dotTriggerPolicyVersion = useSkillDotTriggerPolicyVersion()
  if (capturedReport !== undefined)
    return (
      <div data-battle-skill-parameters="true">
        <strong>Parameters</strong>
        {capturedReport ? (
          <AbilityParameters report={capturedReport} />
        ) : (
          <dl>
            <SkillCharacteristicRows
              rows={MINIMUM_SKILL_INFORMATION_FIELDS.map(
                (field) =>
                  [field, costLabel === 'Unavailable' ? 'Unavailable' : 'Choose action'] as const,
              )}
            />
          </dl>
        )}
      </div>
    )
  const legacyTriggers = dotTriggerPolicyVersion === null
  const legacyPoisonMovement = dotTriggerPolicyVersion !== 2
  const definition = skill.definition
  if (definition?.ability)
    return (
      <div data-battle-skill-parameters="true">
        <strong>Parameters</strong>
        <AbilityDefinitionParameters
          definition={definition.ability}
          effectDescriptions={definition.effectDescriptions}
        />
      </div>
    )
  const legacyRows = battleSkillParameterRows(skill, timingPolicy, {
    ...groundRules,
    airborneAttackElevation,
  })
  const rows = legacyRows.map(
    ([field, value]) =>
      [
        field,
        field === 'Cost'
          ? (costLabel ?? value)
          : field === 'Cooldown'
            ? (cooldownLabel ?? value)
            : value,
      ] as const,
  )
  return (
    <div data-battle-skill-parameters="true">
      <strong>Parameters</strong>
      <dl>
        <SkillCharacteristicRows
          rows={rows}
          targetDetails={definition ? <SkillGroundAreaDetails skill={definition} /> : undefined}
          targetMethodExplanation={
            definition ? skillTargetMethodExplanation(definition) : undefined
          }
          effectSummary={
            definition
              ? definition.effects.length > 0
                ? groupSkillEffects(definition.effects, definition.effectDescriptions).map(
                    ({ effect, count, firstIndex: index }) => (
                      <div key={index}>
                        <CompactSkillEffectSummary
                          effect={effect}
                          count={count}
                          skillEffects={definition.effects}
                        />
                      </div>
                    ),
                  )
                : 'N/A'
              : undefined
          }
        />
      </dl>
      {definition ? (
        <ul aria-label="Effect explanations">
          {skillPreviewEffects(definition, {
            legacyTriggers,
            legacyPoisonMovement,
            ...groundRules,
            timingPolicy,
          }).map((effect, index) => (
            <li key={index}>
              <strong>
                <EffectTagLabel label={effect.label} />
              </strong>{' '}
              — {effect.explanation}
            </li>
          ))}
        </ul>
      ) : null}
      {skill.requirementDescriptions.length > 0 ? (
        <>
          <strong>Requirement details</strong>
          <ul>
            {skill.requirementDescriptions.map((requirement, index) => (
              <li key={index}>{requirement}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
