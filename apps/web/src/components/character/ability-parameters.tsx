import type { BattleAbilityBehaviorReport } from '@/lib/battle/battle-basic-actions'
import { CompactEffectSummary, EffectTagLabel } from './compact-skill-effect-summary'
import { SkillCharacteristicRows } from './skill-characteristic-rows'

/** Render the shared public mechanics report without raw execution data or prose parsing. */
export function AbilityParameters({
  report,
  characteristicsClassName,
  effectExplanationsClassName,
}: {
  report: BattleAbilityBehaviorReport
  characteristicsClassName?: string
  effectExplanationsClassName?: string
}) {
  const selfOnly = report.rows.some(([field, value]) => field === 'Target' && value === 'Self')
  return (
    <div data-ability-parameters="true">
      <dl className={characteristicsClassName}>
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
      {report.maintenance ? <p>{report.maintenance}</p> : null}
      {report.effectDescriptions.length ? (
        <ul className={effectExplanationsClassName} aria-label="Effect explanations">
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
