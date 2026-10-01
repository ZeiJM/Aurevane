import { CompactSkillEffectSummary } from '../character/compact-skill-effect-summary'
import { battleSkillParameterRows } from './battle-preview-content'
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
