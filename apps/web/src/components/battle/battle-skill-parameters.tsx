import { CompactSkillEffectSummary } from '../character/compact-skill-effect-summary'
import {
  skillCompactRangeDescription,
  skillCooldownDescription,
  skillCostDescription,
  skillLineOfSightDescription,
  skillRequirementsSummary,
  skillTargetDescription,
  skillTargetElevationDescription,
  skillTargetMethodDescription,
  skillTypeDescription,
} from '../character/skill-detail-presentation'
import { skillPreviewEffects } from '../character/skill-effect-preview'
import type { BattleSkillForecastPresentation } from './battle-runtime'

/** Uses the same pinned definitions and parameter/effect renderers as Skill Management. */
export function BattleSkillParameters({ skill }: { skill: BattleSkillForecastPresentation }) {
  const definition = skill.definition
  const rows: readonly (readonly [string, string])[] = definition
    ? [
        ['Skill Type', skillTypeDescription(definition)],
        [
          'Cost',
          skillCostDescription({ ...definition, apCost: skill.apCost, mpCost: skill.mpCost }),
        ],
        ['Cooldown', skillCooldownDescription(definition)],
        ['Requirements', skillRequirementsSummary(definition)],
        ['Range', skillCompactRangeDescription(definition)],
        ['Target', skillTargetDescription(definition)],
        ['Target Method', skillTargetMethodDescription(definition)],
        ['Target Elevation', skillTargetElevationDescription(definition)],
        ['Line of Sight', skillLineOfSightDescription(definition)],
      ]
    : [
        ['Cost', `${skill.apCost} AP · ${skill.mpCost} MP`],
        ['Range', `${skill.minimumRange}–${skill.maximumRange} tiles`],
        ['Target', `${skill.targetTeamPolicy} · ${skill.targetKind}`],
      ]
  return (
    <div data-battle-skill-parameters="true">
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <strong>Effects</strong>
      {definition ? (
        <>
          <div>
            {definition.effects.map((effect, index) => (
              <CompactSkillEffectSummary key={index} effect={effect} />
            ))}
          </div>
          <ul aria-label="Effect explanations">
            {skillPreviewEffects(definition).map((effect, index) => (
              <li key={index}>{effect.explanation}</li>
            ))}
          </ul>
        </>
      ) : (
        <ul>
          {skill.effectDescriptions.map((effect, index) => (
            <li key={index}>{effect}</li>
          ))}
        </ul>
      )}
      {skill.requirementDescriptions.length > 0 ? (
        <>
          <strong>Requirements</strong>
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
