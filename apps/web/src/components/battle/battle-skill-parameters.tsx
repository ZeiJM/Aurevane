import { CompactSkillEffectSummary } from '../character/compact-skill-effect-summary'
import { battleSkillParameterRows, battleSkillTargetingDetails } from './battle-preview-content'
import { skillPreviewEffects } from '../character/skill-effect-preview'
import type { BattleSkillForecastPresentation } from './battle-runtime'

/** Uses the same pinned definitions and parameter/effect renderers as Skill Management. */
export function BattleSkillParameters({ skill }: { skill: BattleSkillForecastPresentation }) {
  const definition = skill.definition
  const rows = battleSkillParameterRows(skill)
  return (
    <div data-battle-skill-parameters="true">
      <strong>Parameters</strong>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {label === 'Effects' && definition
                ? definition.effects.length > 0
                  ? definition.effects.map((effect, index) => (
                      <div key={index}>
                        <CompactSkillEffectSummary effect={effect} />
                      </div>
                    ))
                  : 'N/A'
                : value}
            </dd>
          </div>
        ))}
      </dl>
      <p>{battleSkillTargetingDetails(skill)}</p>
      {definition ? (
        <ul aria-label="Effect explanations">
          {skillPreviewEffects(definition).map((effect, index) => (
            <li key={index}>{effect.explanation}</li>
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
