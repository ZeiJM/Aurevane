import { AbilityEffectExplanations } from './ability-effect-explanations'
import type { BattleAbilityBehaviorReport } from '@/lib/battle/battle-basic-actions'
import { CompactEffectSummary } from './compact-skill-effect-summary'
import { SkillCharacteristicRows } from './skill-characteristic-rows'

/** Render the shared public mechanics report without raw execution data or prose parsing. */
export function AbilityParameters({
  report,
  characteristicsClassName,
  effectExplanationsClassName,
  showActivationNotes = true,
  showEffectExplanations = true,
}: {
  report: BattleAbilityBehaviorReport
  characteristicsClassName?: string
  effectExplanationsClassName?: string
  showActivationNotes?: boolean
  showEffectExplanations?: boolean
}) {
  const visibleLimits = report.limits.filter((limit) => limit !== 'Once per round')
  return (
    <div data-ability-parameters="true">
      <dl className={characteristicsClassName}>
        <SkillCharacteristicRows
          rows={report.rows}
          targetMethodExplanation={report.targetMethodExplanation}
          requirementParts={report.requirementParts}
          effectSummary={
            report.effects.length
              ? report.effects.map(({ parts, tagPresentation }, index) => (
                  <div key={index}>
                    <CompactEffectSummary parts={parts} tagPresentation={tagPresentation} />
                  </div>
                ))
              : 'N/A'
          }
        />
      </dl>
      {showActivationNotes && report.automaticActivation ? (
        <p>Automatic: {report.automaticActivation}</p>
      ) : null}
      {report.maintenance ? <p>{report.maintenance}</p> : null}
      {showEffectExplanations ? (
        <AbilityEffectExplanations reports={[report]} className={effectExplanationsClassName} />
      ) : null}
      {showActivationNotes && visibleLimits.length ? (
        <ul aria-label="Usage limits">
          {visibleLimits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
