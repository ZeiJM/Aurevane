import type { Route } from 'next'
import Link from 'next/link'

import { AurevaneImage } from '@/components/media/aurevane-image'
import type { PublicBodyBlock } from '@/content/public-information'

import styles from './manual-article.module.css'

interface ManualArticleProps {
  category: string
  title: string
  summary: string
  lastUpdated: string
  rulesVersion?: string
  body: readonly PublicBodyBlock[]
}

export function ManualArticle({
  category,
  title,
  summary,
  lastUpdated,
  rulesVersion,
  body,
}: ManualArticleProps) {
  const titledBlocks = body.filter((block) => block.title)

  return (
    <article
      className={styles.article}
      data-testid="manual-article"
      data-manual-article-surface="ink"
    >
      <nav className={styles.breadcrumb} aria-label="Manual breadcrumb">
        <Link href={'/manual' as Route}>Manual</Link>
        <span aria-hidden="true">›</span>
        <span>{category}</span>
      </nav>

      <header className={styles.header}>
        <span className={styles.eyebrow}>{category}</span>
        <h1>{title}</h1>
        <p className={styles.summary}>{summary}</p>
        <dl className={styles.meta}>
          <div>
            <dt>Last updated</dt>
            <dd>{lastUpdated}</dd>
          </div>
          {rulesVersion ? (
            <div>
              <dt>Current rule</dt>
              <dd>{rulesVersion}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      <div className={styles.heroMedia} data-testid="manual-article-hero-media" aria-hidden="true">
        <AurevaneImage
          assetId="environment.archive.interior"
          className={styles.heroImage}
          sizes="(max-width: 768px) 100vw, 68rem"
        />
        <span className={styles.heroVeil} />
      </div>

      <div className={styles.layout}>
        {titledBlocks.length > 0 ? (
          <nav
            className={styles.contents}
            data-testid="manual-article-toc"
            aria-label="In this article"
          >
            <span className={styles.contentsLabel}>In this article</span>
            <ul>
              {titledBlocks.map((block) => (
                <li key={block.id}>
                  <a href={`#${block.id}`}>{block.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className={styles.body} data-testid="manual-article-body">
          {body.map((block) => (
            <section className={styles.section} id={block.id} key={block.id}>
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
      </div>

      <Link className={styles.backLink} href={'/manual' as Route}>
        ← Back to the Manual
      </Link>
    </article>
  )
}
