import { Kicker } from '@aurevane/ui'

import { AurevaneImage } from '@/components/media/aurevane-image'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'

import { PracticePlanCard, type PracticePlanCardData } from './practice-plan-card'
import { TrainingReportCard, type TrainingReportCardData } from './training-report-card'
import styles from './offline-training-shell.module.css'
import panels from './training-workspace.module.css'

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
    <AuthenticatedShellFrame sessionLabel="Passive Training">
      <div className={styles.layout} data-training-concept="true" data-av-surface="ink">
        <section className={styles.hero} data-training-scene="true">
          <AurevaneImage
            assetId="ui.foundation.vista"
            className={styles.heroMedia}
            sizes="(max-width: 760px) 100vw, 90vw"
          />
          <div className={styles.heroShade} aria-hidden="true" />
          <header className={styles.heroCopy}>
            <Kicker marker="◇">Discipline in stillness</Kicker>
            <h1>Passive Training</h1>
            <p>Even in silence, you grow.</p>
          </header>
          <div className={styles.heroIdentity}>
            <span>THE PATH CONTINUES</span>
            <strong>{characterName}</strong>
            <small>Your time away. Your progress forward.</small>
          </div>
        </section>

        <nav className={styles.sectionNavigation} aria-label="Training sections">
          <a href="#training-plan">
            <span aria-hidden="true">◇</span> Training Plan
          </a>
          <a href="#training-current">
            <span aria-hidden="true">◷</span> Current Training
          </a>
          <a href="#training-report-workspace">
            <span aria-hidden="true">▤</span> Training Report
          </a>
        </nav>

        <div className={styles.workspace} data-training-workspace="true">
          <PracticePlanCard
            practice={practicePlan}
            hasReport={trainingReport !== null}
            report={
              <aside
                className={panels.reportWorkspace}
                id="training-report-workspace"
                aria-label="Training report workspace"
                tabIndex={-1}
              >
                {trainingReport ? (
                  <TrainingReportCard report={trainingReport} />
                ) : (
                  <section className={panels.panel} data-av-surface="ink">
                    <header className={panels.heading}>
                      <div>
                        <span className={panels.eyebrow}>03 / Your progress</span>
                        <h2>Training Report</h2>
                      </div>
                    </header>
                    <AurevaneImage
                      assetId="environment.passive-training.cloister"
                      className={panels.reportScene}
                      sizes="(max-width: 760px) 100vw, 30vw"
                    />
                    <div className={panels.emptyState}>
                      <span className={panels.emblem} aria-hidden="true">
                        ◇
                      </span>
                      <h3>No report waiting</h3>
                      <p>Completed training and early-stop rewards appear here, ready to claim.</p>
                    </div>
                    <p className={panels.footnote}>Small steps. A greater journey.</p>
                  </section>
                )}
              </aside>
            }
          />
        </div>
      </div>
    </AuthenticatedShellFrame>
  )
}
