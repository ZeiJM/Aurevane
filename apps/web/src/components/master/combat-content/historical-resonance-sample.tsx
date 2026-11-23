import type {
  CombatContentHistoricalSample,
  CombatContentPreviewSummary,
} from './combat-content-workflow'
import styles from './combat-content-editor.module.css'
import sampleStyles from './historical-resonance-sample.module.css'

const fixtureNames: Readonly<Record<string, string>> = {
  'master-preview-actor': 'Owner',
  'master-preview-ally': 'Ally',
  'master-preview-enemy': 'Enemy',
  'master-preview-enemy-2': 'Second enemy',
}
function resource(value: number | null): string {
  return value === null ? 'N/A' : String(value)
}
export function HistoricalResonanceSample({
  sample,
  simulation,
}: {
  readonly sample: CombatContentHistoricalSample
  readonly simulation: CombatContentPreviewSummary['simulation']
}) {
  return (
    <section
      className={`${styles.reviewBlock} ${sampleStyles.sample}`}
      aria-label="Historical Resonance sample"
    >
      <h3>Historical Resonance sample</h3>
      <p>
        Same-turn sample in a fixed, seeded local battle. These are actual command results, not a
        forecast. No real battle changes; later turns and delayed ticks are not simulated.
      </p>
      <p role="status">
        {sample.activated ? 'Activated in this sample.' : 'Not activated in this sample.'}
        {sample.steps.some((step) => !step.ran) ? ' Sample stopped at an unavailable command.' : ''}
      </p>
      <p>
        Local randomness:{' '}
        {simulation?.rngConsumed === true
          ? 'used'
          : simulation?.rngConsumed === false
            ? 'unused'
            : 'Unavailable'}
        .
      </p>
      {sample.steps.map((step, index) => (
        <section
          key={`${index}:${step.referenceAction.id}`}
          aria-label={`Sample step ${index + 1}`}
        >
          <h4>
            {sample.mode === 'sequence' && index === 0 ? 'Setup' : 'Trigger'} ·{' '}
            {step.ran ? 'Executed' : 'Unavailable'}
          </h4>
          <p>
            <code>{step.referenceAction.id}</code> v{step.referenceAction.contentVersion}
          </p>
          {step.costs ? (
            <p>
              Quoted command cost: {step.costs.actionEconomy} AP · {step.costs.mp} MP
              {!step.ran ? ' · not paid' : ''}
            </p>
          ) : null}
          {step.issues.length ? (
            <ul aria-label={`Sample step ${index + 1} issues`}>
              {step.issues.map((issue, i) => (
                <li key={`${issue.code}:${i}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
          {step.resonanceEvents.length ? (
            <ul aria-label={`Sample step ${index + 1} Resonance events`}>
              {step.resonanceEvents.map((event, i) => (
                <li key={`${event.event}:${i}`}>
                  {event.event === 'resonance_armed'
                    ? 'Armed'
                    : event.event === 'resonance_activated'
                      ? 'Activated'
                      : 'Expired'}{' '}
                  · {event.resonanceId} v{event.contentVersion}
                  {event.setupActionId ? ` · Setup ${event.setupActionId}` : ''}
                  {event.triggerActionId ? ` · Trigger ${event.triggerActionId}` : ''}
                  {event.interruptedByActionId
                    ? ` · Interrupted by ${event.interruptedByActionId}`
                    : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p>No Resonance transition in this step.</p>
          )}
          {step.combatants.map((unit) => (
            <details key={unit.id} open={unit.id === 'master-preview-actor'}>
              <summary>
                {fixtureNames[unit.id] ?? unit.id} ·{' '}
                {!unit.presentBefore ? 'Appeared' : !unit.presentAfter ? 'Removed' : 'Present'}
              </summary>
              <dl className={styles.previewFacts}>
                {(['hp', 'mp', 'ap', 'barrier'] as const).map((key) => (
                  <div key={key}>
                    <dt>{key === 'barrier' ? 'Barrier' : key.toUpperCase()}</dt>
                    <dd>
                      {resource(unit[`${key}Before`])} → {resource(unit[`${key}After`])}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </section>
      ))}
      {sample.armedByActionId ? <p>Still armed by {sample.armedByActionId}.</p> : null}
    </section>
  )
}
