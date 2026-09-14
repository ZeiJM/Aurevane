import { Surface } from '@aurevane/ui'

import { AurevaneImage } from '@/components/media/aurevane-image'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'

import { PracticePlanCard, type PracticePlanCardData } from './practice-plan-card'
import { TrainingReportCard, type TrainingReportCardData } from './training-report-card'
import styles from './offline-training-shell.module.css'

interface OfflineTrainingShellProps {
  characterName: string
  practicePlan: PracticePlanCardData
  trainingReport: TrainingReportCardData | null
}

export function OfflineTrainingShell({ practicePlan, trainingReport }: OfflineTrainingShellProps) {
  return (
    <AuthenticatedShellFrame
      sessionLabel="Passive Training"
      backHref="/game/character"
      backLabel="Back to Character Profile"
    >
      <div className={styles.layout} data-training-concept="true">
        <Surface className={styles.hero} tone="elevated" data-av-surface="ink">
          <AurevaneImage
            assetId="environment.passive-training.cloister"
            className={styles.heroMedia}
            sizes="(max-width: 900px) 100vw, 70vw"
          />
          <div className={styles.heroShade} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <h1>Passive Training</h1>
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
