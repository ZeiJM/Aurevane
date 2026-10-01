import { Kicker } from '@aurevane/ui'

import {
  CharacterIdentityCard,
  type CharacterIdentityCardProps,
} from '@/components/character/character-identity-card'
import { CharacterRailSynchronizedLayout } from '@/components/character/character-rail-synchronized-layout'
import { AurevaneImage } from '@/components/media/aurevane-image'

import { PracticePlanCard, type PracticePlanCardData } from './practice-plan-card'
import type { TrainingReportCardData } from './training-report-card'
import styles from './offline-training-shell.module.css'

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
    <CharacterRailSynchronizedLayout className={styles.layout} data-training-concept="true">
      <CharacterIdentityCard {...identity} />

      <section className={styles.sheet} data-training-sheet="true">
        <section className={styles.hero} data-training-scene="true">
          <AurevaneImage
            assetId="environment.passive-training.cloister"
            className={styles.heroMedia}
            sizes="(max-width: 760px) 100vw, 72vw"
          />
          <span className={styles.heroWash} aria-hidden="true" />
          <header className={styles.heroCopy}>
            <Kicker marker="◇">Discipline in stillness</Kicker>
            <h1>Passive Training</h1>
            <p>Even in silence, you grow.</p>
          </header>
        </section>

        <div className={styles.workspace} data-training-workspace="true">
          <PracticePlanCard practice={practicePlan} trainingReport={trainingReport} />
        </div>
      </section>
    </CharacterRailSynchronizedLayout>
  )
}
