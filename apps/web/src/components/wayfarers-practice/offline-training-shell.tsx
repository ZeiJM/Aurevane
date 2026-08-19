import { Kicker, Surface } from '@aurevane/ui'

import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'

import { OfflineTrainingClock } from './offline-training-clock'
import { PracticePlanCard, type PracticePlanCardData } from './practice-plan-card'
import { TrainingReportCard, type TrainingReportCardData } from './training-report-card'
import styles from './offline-training-shell.module.css'

interface OfflineTrainingShellProps {
  characterName: string
  practicePlan: PracticePlanCardData
  trainingReport: TrainingReportCardData | null
}

export function OfflineTrainingShell({
  characterName,
  practicePlan,
  trainingReport,
}: OfflineTrainingShellProps) {
  return (
    <AuthenticatedShellFrame
      sessionLabel="Wayfarer's Practice"
      backHref="/game/character"
      backLabel="Back to Character Profile"
    >
      <div className={styles.layout}>
        <Surface className={styles.hero} tone="elevated">
          <div className={styles.heroCopy}>
            <Kicker marker="◇">Progress while away</Kicker>
            <h1>Wayfarer&apos;s Practice</h1>
            <p>
              Set what you expect {characterName} to practice before you leave. There is no browser
              timer to babysit: after the normal offline threshold, the server measures legitimate
              time away and grants modest progress when you return.
            </p>
          </div>
          <div className={styles.explainer}>
            <span>Set a plan</span>
            <i>→</i>
            <span>Leave normally</span>
            <i>→</i>
            <span>Return to a report</span>
          </div>
          <OfflineTrainingClock
            serverNow={practicePlan.serverNow}
            minimumOfflineSeconds={practicePlan.minimumOfflineSeconds}
          />
        </Surface>

        <div className={styles.practiceGrid}>
          <PracticePlanCard practice={practicePlan} />
          {trainingReport ? <TrainingReportCard report={trainingReport} /> : null}
        </div>
      </div>
    </AuthenticatedShellFrame>
  )
}
