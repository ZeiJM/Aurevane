import type { Route } from 'next'
import Link from 'next/link'

import type { PublicBodyBlock } from '@/content/public-information'

import styles from './public-information-shell.module.css'

interface PublicArticleProps {
  category: string
  title: string
  summary: string
  lastUpdated: string
  rulesVersion?: string
  body: readonly PublicBodyBlock[]
  backHref: Route
  backLabel: string
}

export function PublicArticle({
  category,
  title,
  summary,
  lastUpdated,
  rulesVersion,
  body,
  backHref,
  backLabel,
}: PublicArticleProps) {
  return (
    <article className={styles.article}>
      <Link className={styles.backLink} href={backHref}>
        ← {backLabel}
      </Link>

      <header className={styles.articleHeader}>
        <span className={styles.eyebrow}>{category}</span>
        <h1>{title}</h1>
        <p>{summary}</p>
        <dl className={styles.articleMeta}>
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

      <div className={styles.articleBody}>
        {body.map((block) => (
          <section key={block.id} id={block.id} className={styles.articleSection}>
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
    </article>
  )
}
