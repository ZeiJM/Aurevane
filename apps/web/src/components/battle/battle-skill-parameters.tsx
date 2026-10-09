'use client'

import { groupSkillEffects } from '../character/skill-effect-groups'

import { skillTargetMethodExplanation } from '../character/skill-detail-presentation'
import {
  useSkillGroundInteractionRules,
  useAirborneAttackElevation,
  useSkillEffectTimingPolicy,
  useSkillDotTriggerPolicyVersion,
} from '../character/skill-effect-timing-context'
import { CompactSkillEffectSummary } from '../character/compact-skill-effect-summary'
import { battleSkillParameterRows } from './battle-preview-content'
import { skillPreviewEffects } from '../character/skill-effect-preview'
import { SkillGroundAreaDetails } from '../character/skill-ground-area-details'
import type { BattleSkillForecastPresentation } from './battle-runtime'
import { SkillCharacteristicRows } from '../character/skill-characteristic-rows'

/** Uses the same pinned definitions and parameter/effect renderers as Skill Management. */
export function BattleSkillParameters({ skill }: { skill: BattleSkillForecastPresentation }) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const groundRules = useSkillGroundInteractionRules()
  const airborneAttackElevation = useAirborneAttackElevation()
  const dotTriggerPolicyVersion = useSkillDotTriggerPolicyVersion()
  const legacyTriggers = dotTriggerPolicyVersion === null
  const legacyPoisonMovement = dotTriggerPolicyVersion !== 2
  const definition = skill.definition
  const rows = battleSkillParameterRows(skill, timingPolicy, {
    ...groundRules,
    airborneAttackElevation,
  })
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
                        <CompactSkillEffectSummary effect={effect} count={count} />
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
              <strong>{effect.label}</strong> — {effect.explanation}
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
