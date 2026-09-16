import type { Metadata } from 'next'
import Link from 'next/link'

import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import { newsArticles } from '@/content/public-information'

import styles from './news-index.module.css'

export const metadata: Metadata = {
  title: 'News | AUREVANE',
  description: 'Official AUREVANE updates, changes, and public notices.',
}

export default function NewsPage() {
  return (
    <PublicInformationShell active="news">
      <div className={styles.board} data-testid="news-index-board" data-news-surface="ink">
        <section className={styles.hero} aria-labelledby="news-title">
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>Official record</span>
            <h1 id="news-title">News</h1>
            <p className={styles.tagline}>Updates from beyond the veil.</p>
            <p className={styles.description}>
              What changed, what is happening, and what the AUREVANE team needs players to know.
            </p>
          </div>
        </section>

        <section className={styles.archive} aria-labelledby="latest-news-title">
          {newsArticles.length === 0 ? (
            <div className={styles.emptyState} data-testid="news-empty-state">
              <span className={styles.emptyGlyph} aria-hidden="true">
                ◇
              </span>
              <span className={styles.kicker}>No synthetic archive</span>
              <h2 id="latest-news-title">No public posts yet.</h2>
              <p>
                The chronicle is quiet for now. Real patch notes, maintenance notices, testing
                updates, and release communication will appear here when there is something truthful
                to publish.
              </p>
              <nav className={styles.links} aria-label="Continue reading">
                <Link href="/manual">Open the Manual</Link>
                <Link href="/rules">Read the Rules</Link>
              </nav>
              <span className={styles.closingLine} aria-hidden="true">
                Good things take time.
              </span>
            </div>
          ) : null}
        </section>
      </div>
    </PublicInformationShell>
  )
}
