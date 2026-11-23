import { AbilityEffectExplanations } from './ability-effect-explanations'
import type { BattleAbilityBehaviorReport } from '@/lib/battle/battle-basic-actions'
import { CompactEffectSummary } from './compact-skill-effect-summary'
import { SkillCharacteristicRows } from './skill-characteristic-rows'
import type { SkillCharacteristic } from './skill-information-contract'

/** Render the shared public mechanics report without raw execution data or prose parsing. */
export function AbilityParameters({
  report,
  rows,
  characteristicsClassName,
  effectExplanationsClassName,
  showActivationNotes = true,
  showMaintenance = true,
  showEffectExplanations = true,
}: {
  report: BattleAbilityBehaviorReport
  rows?: readonly SkillCharacteristic[]
  characteristicsClassName?: string
  effectExplanationsClassName?: string
  showActivationNotes?: boolean
  showMaintenance?: boolean
  showEffectExplanations?: boolean
}) {
  const visibleLimits = report.limits.filter((limit) => limit !== 'Once per round')
  return (
    <div data-ability-parameters="true">
      <dl className={characteristicsClassName}>
        <SkillCharacteristicRows
          rows={rows ?? report.rows}
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
      {showMaintenance && report.maintenance ? <p>{report.maintenance}</p> : null}
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
