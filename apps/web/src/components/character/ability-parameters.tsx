import { MechanicTextView } from './mechanic-text-view'
import type { BattleAbilityBehaviorReport } from '@/lib/battle/battle-basic-actions'
import {
  CompactEffectSummary,
  EffectTagLabel,
  EffectExplanationNotes,
} from './compact-skill-effect-summary'
import { SkillCharacteristicRows } from './skill-characteristic-rows'
import { RequirementExplanations } from './requirement-explanations'

/** Render the shared public mechanics report without raw execution data or prose parsing. */
export function AbilityParameters({
  report,
  characteristicsClassName,
  effectExplanationsClassName,
  showActivationNotes = true,
}: {
  report: BattleAbilityBehaviorReport
  characteristicsClassName?: string
  effectExplanationsClassName?: string
  showActivationNotes?: boolean
}) {
  return (
    <div data-ability-parameters="true">
      <dl className={characteristicsClassName}>
        <SkillCharacteristicRows
          rows={report.rows}
          requirementParts={report.requirementParts}
          effectSummary={
            report.effects.length
              ? report.effects.map(({ parts, recipientOverride }, index) => (
                  <div key={index}>
                    <CompactEffectSummary parts={parts} />
                    {recipientOverride ? ` [${recipientOverride}]` : null}
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
      <RequirementExplanations
        text={report.rows.find(([label]) => label === 'Requirements')?.[1] ?? 'None'}
        parts={report.requirementParts}
        className={effectExplanationsClassName}
      />
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
              <MechanicTextView
                text={description}
                parts={report.effects[index]?.explanationParts}
              />
              {report.effects[index] ? (
                <EffectExplanationNotes
                  parts={report.effects[index]!.parts}
                  repeatsOnEntry={report.effects[index]!.repeatsOnEntry}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {showActivationNotes && report.limits.length ? (
        <ul aria-label="Usage limits">
          {report.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
