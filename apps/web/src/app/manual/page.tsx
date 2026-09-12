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
            The canonical player guide to how AUREVANE’s current systems work, plus clearly marked
            long-horizon systems whose rules already shape the game being built. Playable testing
            behavior and future acquisition rules are kept distinct.
          </p>
        </div>
        <aside className={styles.heroPanel} aria-label="Manual editorial boundary">
          <span className={styles.heroGlyph} aria-hidden="true">
            ◆
          </span>
          <strong>Read the game, not the code.</strong>
          <p>
            Character creation, Disciplines and Mastery, six attributes, Battle Hall, Passive
            Training, profile identity, and the current navigation model are explained in player
            language from the same rules that drive the test build.
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
            Start with orientation, then open the focused article for the system you are testing or
            planning around.
          </p>
        </div>

        <div className={styles.cardGrid}>
          <Link className={styles.card} href={'/manual/disciplines-mastery' as Route}>
            <span className={styles.cardCategory}>Character</span>
            <h3>Disciplines, Atlas &amp; Mastery</h3>
            <p>
              The full 36-Discipline map, mastery stages, class-budget philosophy, Rekindling gates,
              secret paths, pure versus mixed builds, and the temporary Phase-4 testing rule.
            </p>
            <span className={styles.cardMeta}>Updated 2026-09-12</span>
          </Link>

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
