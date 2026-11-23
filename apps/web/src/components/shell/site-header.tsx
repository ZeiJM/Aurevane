import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import styles from '../public-information/public-header-rail.module.css'

interface SiteHeaderProps {
  brandHref: Route | '#account-main'
  brandLabel: string
  utility: ReactNode
  className?: string
  utilityClassName?: string
  navigationLabel?: string
  activeSection?: 'news' | 'manual' | 'rules'
}

/** One masthead presentation; each shell keeps its own identity and account authority. */
export function SiteHeader({
  brandHref,
  brandLabel,
  utility,
  className,
  utilityClassName,
  navigationLabel = 'Public information',
  activeSection,
}: SiteHeaderProps) {
  return (
    <header
      className={[styles.masthead, className].filter(Boolean).join(' ')}
      data-av-site-header="true"
      data-av-surface="ink"
    >
      <Link className="brand" href={brandHref} prefetch={false} aria-label={brandLabel}>
        <span className="brand__crest" aria-hidden="true">
          <span>A</span>
        </span>
        <span className="brand__wordmark">
          <strong>AUREVANE</strong>
          <small>Persistent tactical fantasy</small>
        </span>
      </Link>
      <nav className={styles.navigation} aria-label={navigationLabel}>
        {(['news', 'manual', 'rules'] as const).map((section) => (
          <Link
            key={section}
            href={`/${section}`}
            prefetch={false}
            aria-current={activeSection === section ? 'page' : undefined}
          >
            {section.charAt(0).toUpperCase() + section.slice(1)}
          </Link>
        ))}
      </nav>
      <div className={[styles.utility, utilityClassName].filter(Boolean).join(' ')}>{utility}</div>
    </header>
  )
}
