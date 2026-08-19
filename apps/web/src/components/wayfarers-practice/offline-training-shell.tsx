import { Kicker, Surface } from '@aurevane/ui'

import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'

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
      sessionLabel="Passive Training"
      backHref="/game/character"
      backLabel="Back to Character Profile"
    >
      <div className={styles.layout}>
        <Surface className={styles.hero} tone="elevated">
          <div className={styles.heroCopy}>
            <Kicker marker="◇">Background progression</Kicker>
            <h1>Passive Training</h1>
            <p>
              Start a timed training block for {characterName}. The server tracks it whether you stay
              signed in or go AFK; nothing begins until you choose a duration.
            </p>
          </div>
          <div className={styles.heroRule}>
            <strong>Simple rule</strong>
            <span>Short is most efficient · Medium is balanced · Extended trades efficiency for time away.</span>
          </div>
        </Surface>

        <div className={styles.practiceGrid} data-has-report={trainingReport ? true : undefined}>
          <PracticePlanCard practice={practicePlan} />
          {trainingReport ? <TrainingReportCard report={trainingReport} /> : null}
        </div>
      </div>
    </AuthenticatedShellFrame>
  )
}
