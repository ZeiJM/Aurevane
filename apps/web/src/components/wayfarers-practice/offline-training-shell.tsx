import { Kicker, Surface } from '@aurevane/ui'

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
      <div className={styles.layout} data-training-concept="true">
        <Surface
          className={styles.hero}
          tone="quiet"
          data-av-surface="ink"
          data-training-scene="true"
        >
          <AurevaneImage
            assetId="environment.passive-training.cloister"
            className={styles.heroMedia}
            sizes="(max-width: 760px) 100vw, 90vw"
          />
          <div className={styles.heroShade} aria-hidden="true" />
          <header className={styles.heroCopy}>
            <Kicker marker="◇">Discipline in stillness</Kicker>
            <h1>Passive Training</h1>
            <p>{characterName} · Every hour, a little further.</p>
          </header>
        </Surface>

        <div className={styles.practiceGrid} data-training-workspace="true">
          <PracticePlanCard practice={practicePlan} />
          <aside className={styles.reportWorkspace} aria-label="Training report workspace">
            {trainingReport ? (
              <TrainingReportCard report={trainingReport} />
            ) : (
              <Surface
                className={styles.emptyReport}
                tone="elevated"
                data-av-surface="moonstone"
                aria-labelledby="training-report-empty-title"
              >
                <header className={styles.reportHeading}>
                  <Kicker marker="◇">Training Report</Kicker>
                  <h2 id="training-report-empty-title">Your progress, recorded.</h2>
                </header>
                <div className={styles.emptyReportBody}>
                  <span className={styles.reportEmblem} aria-hidden="true">
                    ◇
                  </span>
                  <strong>No report waiting</strong>
                  <p>
                    When your training finishes or you stop early, your report and earned XP appear
                    here, ready to claim.
                  </p>
                </div>
                <p className={styles.reportFootnote}>
                  The server keeps time. You do not need to leave this page open.
                </p>
              </Surface>
            )}
          </aside>
        </div>
      </div>
    </AuthenticatedShellFrame>
  )
}
