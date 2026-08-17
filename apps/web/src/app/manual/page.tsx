import type { Metadata, Route } from 'next'
import Link from 'next/link'

import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import styles from '@/components/public-information/public-information-shell.module.css'
import { manualArticles } from '@/content/public-information'

export const metadata: Metadata = {
  title: 'Adventurer’s Guide | AUREVANE',
  description: 'The spoiler-safe public guide to AUREVANE’s released systems.',
}

export default function ManualPage() {
  return (
    <PublicInformationShell active="manual">
      <section className={styles.hero} aria-labelledby="manual-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Adventurer’s Guide</span>
          <h1 id="manual-title">Manual</h1>
          <p>
            The canonical guide to what AUREVANE is and how its released systems work. Planned
            mechanics are labelled as planned instead of being presented as playable today.
          </p>
        </div>
        <aside className={styles.heroPanel} aria-label="Manual editorial boundary">
          <span className={styles.heroGlyph} aria-hidden="true">
            ◆
          </span>
          <strong>Released systems first.</strong>
          <p>
            Stable deep links, current-rule notes, and a source-controlled content model keep this
            guide useful now without prematurely building a CMS.
          </p>
        </aside>
      </section>

      <section className={styles.section} aria-labelledby="manual-index-title">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Browse the guide</span>
            <h2 id="manual-index-title">Phase 1 foundations</h2>
          </div>
          <p>
            Start with orientation, then use the focused articles as canonical help for the systems
            already exposed to players.
          </p>
        </div>

        <div className={styles.cardGrid}>
          {manualArticles.map((article) => (
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
