import Link from 'next/link'

import { AurevaneImage } from '@/components/media/aurevane-image'
import type { NewsArticle as NewsArticleRecord } from '@/content/public-information'

import styles from './news-article.module.css'

function formatPublicDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function NewsArticle({ article }: { article: NewsArticleRecord }) {
  return (
    <article
      className={styles.article}
      data-testid="news-article"
      data-news-article-surface="ink"
    >
      <nav className={styles.breadcrumbs} aria-label="News breadcrumb">
        <Link href="/news">All News</Link>
        <span aria-hidden="true">›</span>
        <span>{article.category}</span>
      </nav>

      <header className={styles.header}>
        <span className={styles.category}>{article.category}</span>
        <h1>{article.title}</h1>
        <p className={styles.summary}>{article.summary}</p>

        <dl className={styles.meta}>
          <div>
            <dt>Published</dt>
            <dd>{formatPublicDate(article.publishedAt)}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{formatPublicDate(article.lastUpdated)}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.hero} data-testid="news-article-hero" aria-hidden="true">
        <AurevaneImage
          assetId="environment.archive.interior"
          className={styles.heroImage}
          sizes="(max-width: 768px) 100vw, 72rem"
        />
        <div className={styles.heroVeil} />
        <span className={styles.heroMotto}>Same world. Brighter tomorrows.</span>
      </div>

      <div className={styles.body} data-testid="news-article-body">
        {article.body.map((block) => (
          <section key={block.id} id={block.id} className={styles.section}>
            {block.title ? <h2>{block.title}</h2> : null}
            {block.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {block.bullets ? (
              <ul>
                {block.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <footer className={styles.footer}>
        <nav className={styles.resources} aria-label="Article resources">
          <Link href="/manual">Manual</Link>
          <Link href="/rules">Rules</Link>
        </nav>
        <Link className={styles.backLink} href="/news">
          ← All News
        </Link>
      </footer>
    </article>
  )
}
