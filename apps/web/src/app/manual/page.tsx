import type { Metadata, Route } from 'next'
import Link from 'next/link'

import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import styles from '@/components/public-information/public-information-shell.module.css'
import { currentManualArticles } from '@/content/current-manual'

export const metadata: Metadata = {
  title: 'Adventurer’s Guide | AUREVANE',
  description: 'The spoiler-safe public guide to AUREVANE’s current playable and testable systems.',
}

export default function ManualPage() {
  return (
    <PublicInformationShell active="manual">
      <section className={styles.hero} aria-labelledby="manual-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Adventurer’s Guide</span>
          <h1 id="manual-title">Manual</h1>
          <p>
            The canonical player guide to how AUREVANE’s current systems work. Phase 1 is complete;
            Phase 2 combat, PvP, and spectation remain under PV-1 (Phase 2 test) while the Owner
            continues testing and polishing the battle platform.
          </p>
        </div>
        <aside className={styles.heroPanel} aria-label="Manual editorial boundary">
          <span className={styles.heroGlyph} aria-hidden="true">
            ◆
          </span>
          <strong>Current systems first.</strong>
          <p>
            Character creation, six attributes, Passive Training, Battle Hall, direct private PvP,
            spectation, profile identity, and navigation are documented from the same implementation
            you test.
          </p>
        </aside>
      </section>

      <section className={styles.section} aria-labelledby="manual-index-title">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Browse the guide</span>
            <h2 id="manual-index-title">Current field guide</h2>
          </div>
          <p>
            Start with orientation, then open the focused article for the system you are testing.
          </p>
        </div>

        <div className={styles.cardGrid}>
          {currentManualArticles.map((article) => (
            <Link
              className={styles.card}
              href={`/manual/${article.slug}` as Route}
              key={article.id}
            >
              <span className={styles.cardCategory}>{article.category}</span>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
              <span className={styles.cardMeta}>Updated {article.lastUpdated}</span>
            </Link>
          ))}
        </div>
      </section>
    </PublicInformationShell>
  )
}
