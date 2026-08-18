import Link from 'next/link'
import type { ReactNode } from 'react'

import styles from './public-information-shell.module.css'

export type PublicInformationSection = 'news' | 'manual' | 'rules'

interface PublicInformationShellProps {
  active: PublicInformationSection
  children: ReactNode
}

const navigation: readonly {
  href: '/news' | '/manual' | '/rules'
  label: string
  section: PublicInformationSection
}[] = [
  { href: '/news', label: 'News', section: 'news' },
  { href: '/manual', label: 'Manual', section: 'manual' },
  { href: '/rules', label: 'Rules', section: 'rules' },
]

export function PublicInformationShell({ active, children }: PublicInformationShellProps) {
  return (
    <div className={styles.shell} data-testid="public-information-shell">
      <a className="skip-link" href="#public-information-main">
        Skip to public information
      </a>

      <header className={styles.masthead}>
        <Link className="brand" href="/" aria-label="AUREVANE account entry home">
          <span className="brand__crest" aria-hidden="true">
            <span>A</span>
          </span>
          <span className="brand__wordmark">
            <strong>AUREVANE</strong>
            <small>Public field guide</small>
          </span>
        </Link>

        <nav className={styles.mastheadNav} aria-label="Public information">
          {navigation.map((item) => (
            <Link
              key={item.section}
              className={styles.navLink}
              href={item.href}
              aria-current={active === item.section ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Link className={styles.playLink} href="/">
            Play / Sign In
          </Link>
        </nav>
      </header>

      <main className={styles.main} id="public-information-main">
        {children}
      </main>
    </div>
  )
}
