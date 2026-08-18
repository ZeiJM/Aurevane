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
      sessionLabel="Offline Training"
      footerLabel={`${characterName} · Offline Training`}
      backHref="/game/character"
      backLabel="Back to Character Profile"
    >
      <div className={styles.layout}>
        <Surface className={styles.hero} tone="elevated">
          <Kicker marker="◇">Character Progression</Kicker>
          <h1>Offline Training</h1>
          <p>
            When {characterName} is away long enough, the server records a small amount of training
            progress and Rested Momentum. Active play never waits for this system and being online
            never consumes a countdown.
          </p>
          <OfflineTrainingClock
            serverNow={practicePlan.serverNow}
            minimumOfflineSeconds={practicePlan.minimumOfflineSeconds}
          />
        </Surface>

        {trainingReport ? <TrainingReportCard report={trainingReport} /> : null}
        <PracticePlanCard practice={practicePlan} />
      </div>
    </AuthenticatedShellFrame>
  )
}
