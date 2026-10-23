'use client'

import type { BasicSkillDefinition } from '@aurevane/game-core/combat/combat-basic-actions'
import type { BasicActionCharacterStats } from './basic-action-presentation'
import { renderAbilityPresentationText } from '@aurevane/game-core/combat/battle-narration'
import { skillDisplayName } from './skill-detail-presentation'

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

export function SkillParameters({
  skill,
  basic,
  stats,
}: {
  skill: MatureSkillDefinition
  basic?: BasicSkillDefinition
  stats?: BasicActionCharacterStats
}) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const groundRules = useSkillGroundInteractionRules()
  if (skill.ability)
    return (
      <>
        {renderAbilityPresentationText(skill, 'compact', { ability: skillDisplayName(skill) }) ? (
          <p>
            {renderAbilityPresentationText(skill, 'compact', { ability: skillDisplayName(skill) })}
          </p>
        ) : null}
        <AbilityDefinitionParameters
          definition={skill.ability}
          basic={basic}
          stats={stats}
          effectDescriptions={skill.effectDescriptions}
        />
      </>
    )
  return (
    <dl>
      {renderAbilityPresentationText(skill, 'compact', { ability: skillDisplayName(skill) }) ? (
        <div>
          <dt>Summary</dt>
          <dd>
            {renderAbilityPresentationText(skill, 'compact', { ability: skillDisplayName(skill) })}
          </dd>
        </div>
      ) : null}
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
