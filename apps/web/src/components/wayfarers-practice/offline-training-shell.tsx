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
    <AuthenticatedShellFrame sessionLabel="Offline Training">
      <div className={styles.layout}>
        <Surface className={styles.hero} tone="elevated">
          <div className={styles.heroCopy}>
            <Kicker marker="◇">Passive Progression</Kicker>
            <h1>Offline Training</h1>
            <p>
              Nothing here is a daily chore. When {characterName} spends enough meaningful time
              away, the server quietly records a modest training reward and Rested Momentum. Your
              selected plan only decides what that passive practice emphasizes; active play is never
              blocked and staying online never wastes a timer.
            </p>
          </div>
          <OfflineTrainingClock
            serverNow={practicePlan.serverNow}
            minimumOfflineSeconds={practicePlan.minimumOfflineSeconds}
          />
        </Surface>

        <div className={styles.trainingGrid}>
          <PracticePlanCard practice={practicePlan} />
          {trainingReport ? <TrainingReportCard report={trainingReport} /> : null}
        </div>
      </div>
    </AuthenticatedShellFrame>
  )
}
