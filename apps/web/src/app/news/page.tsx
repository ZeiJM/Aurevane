import type { Metadata } from 'next'

import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import { newsArticles } from '@/content/public-information'
import styles from '@/components/public-information/public-information-shell.module.css'

export const metadata: Metadata = {
  title: 'News | AUREVANE',
  description: 'Official AUREVANE updates, changes, and public notices.',
}

export default function NewsPage() {
  return (
    <PublicInformationShell active="news">
      <section className={styles.hero} aria-labelledby="news-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Official record</span>
          <h1 id="news-title">News</h1>
          <p>
            What changed, what is happening, and what the AUREVANE team needs players to know. We
            will not manufacture a historical archive before real public updates exist.
          </p>
        </div>
        <aside className={styles.heroPanel} aria-label="News publication status">
          <span className={styles.heroGlyph} aria-hidden="true">
            ◇
          </span>
          <strong>Published information only.</strong>
          <p>Drafts, staff notes, private identifiers, and unreleased content never belong here.</p>
        </aside>
      </section>

      <section className={styles.section} aria-labelledby="latest-news-title">
        {newsArticles.length === 0 ? (
          <div className={styles.emptyState} data-testid="news-empty-state">
            <span className={styles.eyebrow}>No synthetic archive</span>
            <h2 id="latest-news-title">No public posts yet.</h2>
            <p>
              The foundation is ready for real patch notes, maintenance notices, testing updates,
              and release communication when there is something truthful to publish.
            </p>
          </div>
        ) : null}
      </section>
    </PublicInformationShell>
  )
}
