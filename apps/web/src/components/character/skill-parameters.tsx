'use client'

import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { SkillCharacteristicRows } from './skill-characteristic-rows'
import { skillParameterRows } from './skill-detail-presentation'
import {
  useSkillGroundInteractionRules,
  useSkillEffectTimingPolicy,
} from './skill-effect-timing-context'
import { SkillGroundAreaDetails } from './skill-ground-area-details'
import { CompactSkillEffectSummary } from './compact-skill-effect-summary'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { groupSkillEffects } from './skill-effect-groups'

export function SkillParameters({ skill }: { skill: MatureSkillDefinition }) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const groundRules = useSkillGroundInteractionRules()
  if (skill.ability)
    return (
      <AbilityDefinitionParameters
        definition={skill.ability}
        effectDescriptions={skill.effectDescriptions}
      />
    )
  return (
    <dl>
      <SkillCharacteristicRows
        rows={skillParameterRows(skill, skill, timingPolicy, groundRules)}
        targetDetails={<SkillGroundAreaDetails skill={skill} />}
        effectSummary={
          skill.effects.length
            ? groupSkillEffects(skill.effects, skill.effectDescriptions).map(
                ({ effect, count, firstIndex }, index) => (
                  <span key={firstIndex}>
                    {index > 0 ? ', ' : null}
                    <CompactSkillEffectSummary
                      effect={effect}
                      count={count}
                      skillEffects={skill.effects}
                    />
                  </span>
                ),
              )
            : 'N/A'
        }
      />
    </dl>
  )
}
