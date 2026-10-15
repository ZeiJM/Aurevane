import type { BattleAbilityBehaviorReport } from '@/lib/battle/battle-basic-actions'
import { CompactEffectSummary, EffectTagLabel } from './compact-skill-effect-summary'
import { SkillCharacteristicRows } from './skill-characteristic-rows'

/** Render server-projected captured mechanics; no raw execution definition or prose parsing. */
export function AbilityParameters({ report }: { report: BattleAbilityBehaviorReport }) {
  const selfOnly = report.rows.some(([field, value]) => field === 'Target' && value === 'Self')
  return (
    <div data-ability-parameters="true">
      <dl>
        <SkillCharacteristicRows
          rows={report.rows}
          effectSummary={
            report.effects.length
              ? report.effects.map(({ parts, condition, recipient }, index) => (
                  <div key={index}>
                    {condition ? `If ${condition}: ` : null}
                    <CompactEffectSummary parts={parts} />
                    {selfOnly && recipient === 'Self' ? null : ` → ${recipient}`}
                  </div>
                ))
              : 'N/A'
          }
        />
      </dl>
      {report.effectDescriptions.length ? (
        <ul aria-label="Effect explanations">
          {report.effectDescriptions.map((description, index) => (
            <li key={index}>
              {report.effects[index] ? (
                <>
                  <strong>
                    <EffectTagLabel label={report.effects[index]!.parts.label} />
                  </strong>{' '}
                  —{' '}
                </>
              ) : null}
              {description}
            </li>
          ))}
        </ul>
      ) : null}
      {report.limits.length ? (
        <ul aria-label="Usage limits">
          {report.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
