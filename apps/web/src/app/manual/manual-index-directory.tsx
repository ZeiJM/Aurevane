'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'
import type { ImageAssetId } from '@/media/registry'

import styles from './manual-index.module.css'

export interface ManualIndexEntry {
  id: string
  href: Route
  title: string
  summary: string
  category: string
  lastUpdated: string
  assetId: ImageAssetId
}

export function ManualIndexDirectory({ entries }: { entries: readonly ManualIndexEntry[] }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredEntries = useMemo(() => {
    if (!normalizedQuery) {
      return entries
    }

    return entries.filter((entry) =>
      [entry.title, entry.category, entry.summary]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    )
  }, [entries, normalizedQuery])

  return (
    <section
      className={styles.directory}
      data-testid="manual-index-directory"
      data-manual-index-surface="ink"
      aria-labelledby="manual-title"
    >
      <header className={styles.header}>
        <div className={styles.headerScenery} aria-hidden="true">
          <AurevaneImage
            assetId="environment.archive.interior"
            className={styles.headerSceneryImage}
            sizes="(max-width: 768px) 100vw, 74rem"
          />
          <span className={styles.headerVeil} />
        </div>

        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>Adventurer’s Guide</span>
          <h1 id="manual-title">Manual</h1>
          <p>
            The canonical player guide to AUREVANE’s current playable and testable systems. Browse
            every published guide below or search the archive directly.
          </p>
        </div>

        <label className={styles.searchField}>
          <span className={styles.searchLabel}>Search the Manual</span>
          <span className={styles.searchControl}>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Search the Manual"
              placeholder="Search guides"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </span>
        </label>
      </header>

      <div className={styles.directoryHeading}>
        <div>
          <span className={styles.eyebrow}>Current field guide</span>
          <h2>Published guides</h2>
        </div>
        <p aria-live="polite">
          {filteredEntries.length} {filteredEntries.length === 1 ? 'guide' : 'guides'}
        </p>
      </div>

      {filteredEntries.length > 0 ? (
        <div className={styles.rows}>
          {filteredEntries.map((entry) => (
            <Link
              className={styles.row}
              href={entry.href}
              key={entry.id}
              data-testid="manual-guide-row"
            >
              <span className={styles.thumbnail} aria-hidden="true">
                <AurevaneImage
                  assetId={entry.assetId}
                  className={styles.thumbnailImage}
                  sizes="(max-width: 768px) 6rem, 9rem"
                />
                <span className={styles.thumbnailVeil} />
              </span>

              <span className={styles.rowCopy}>
                <span className={styles.category}>{entry.category}</span>
                <strong>{entry.title}</strong>
                <span className={styles.summary}>{entry.summary}</span>
              </span>

              <span className={styles.rowMeta}>
                <span>Updated {entry.lastUpdated}</span>
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState} role="status">
          <strong>No guides match this search.</strong>
          <span>Try a system name, guide title, or category.</span>
        </div>
      )}
    </section>
  )
}
