import { Kicker } from '@aurevane/ui'

import {
  CharacterIdentityCard,
  type CharacterIdentityCardProps,
} from '@/components/character/character-identity-card'
import { AurevaneImage } from '@/components/media/aurevane-image'

import { PracticePlanCard, type PracticePlanCardData } from './practice-plan-card'
import { TrainingReportCard, type TrainingReportCardData } from './training-report-card'
import styles from './offline-training-shell.module.css'
import panels from './training-workspace.module.css'

interface OfflineTrainingShellProps {
  identity: CharacterIdentityCardProps
  practicePlan: PracticePlanCardData
  trainingReport: TrainingReportCardData | null
}

export function OfflineTrainingShell({
  identity,
  practicePlan,
  trainingReport,
}: OfflineTrainingShellProps) {
  return (
    <div className={styles.layout} data-training-concept="true">
        <CharacterIdentityCard {...identity} />

        <section className={styles.sheet} data-av-surface="moonstone">
          <section className={styles.hero} data-training-scene="true">
            <AurevaneImage
              assetId="ui.foundation.vista"
              className={styles.heroMedia}
              sizes="(max-width: 760px) 100vw, 72vw"
            />
            <span className={styles.heroWash} aria-hidden="true" />
            <header className={styles.heroCopy}>
              <Kicker marker="◇">Discipline in stillness</Kicker>
              <h1>Passive Training</h1>
              <p>Even in silence, you grow.</p>
            </header>
            <div className={styles.heroIdentity}>
              <span>Same steps. A farther horizon.</span>
              <small>Your time away.</small>
              <small>Your progress forward.</small>
            </div>
          </section>

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
                    <section className={panels.panel} data-av-surface="moonstone">
                      <header className={panels.heading}>
                        <div>
                          <span className={panels.eyebrow}>03 / Training Report</span>
                          <h2>Training Report</h2>
                        </div>
                      </header>
                      <AurevaneImage
                        assetId="environment.passive-training.cloister"
                        className={panels.reportScene}
                        sizes="(max-width: 760px) 100vw, 24vw"
                      />
                      <div className={panels.emptyState}>
                        <span className={panels.reportGlyph} aria-hidden="true">
                          ▤
                        </span>
                        <h3>No report waiting</h3>
                        <p>Your completed training sessions will appear here with their rewards.</p>
                      </div>
                      <p className={panels.footnote}>“Even in absence, discipline bears fruit.”</p>
                    </section>
                  )}
                </aside>
              }
            />
          </div>

          <details className={styles.trainingHelp}>
            <summary>
              <span className={styles.helpIcon} aria-hidden="true">
                ?
              </span>
              <span>
                <strong>How Passive Training works</strong>
                <small>
                  Continue to gain experience while you are away. Longer sessions grant larger
                  rewards.
                </small>
              </span>
              <b>Learn More →</b>
            </summary>
            <p>
              While training is active, new Battle Hall fights are disabled. Profile, account,
              reference pages, Online Users, and social/chat surfaces remain available. If you stop
              early, the server awards XP for the completed fraction of the training time.
            </p>
          </details>
        </section>
    </div>
  )
}
