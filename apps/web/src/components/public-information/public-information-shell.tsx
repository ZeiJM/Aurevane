import Link from 'next/link'
import type { ReactNode } from 'react'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'

import headerLayout from './public-header-layout.module.css'
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

async function loadOptionalGameIdentity() {
  try {
    const actor = await getAuthenticatedActor()
    return {
      authenticated: true as const,
      character: await loadSelectedCharacter(actor),
    }
  } catch {
    return {
      authenticated: false as const,
      character: null,
    }
  }
}

export async function PublicInformationShell({ active, children }: PublicInformationShellProps) {
  const identity = await loadOptionalGameIdentity()
  const character = identity.character
  const gameHref = identity.authenticated ? (character ? '/game/character' : '/game') : '/'
  const gameLabel = identity.authenticated
    ? character
      ? 'Return to Game'
      : 'Character Select'
    : 'Play / Sign In'

  return (
    <div className={styles.shell} data-testid="public-information-shell">
      <a className="skip-link" href="#public-information-main">
        Skip to public information
      </a>

      <header className={`${styles.masthead} ${headerLayout.headerGrid}`}>
        <Link
          className="brand"
          href={gameHref}
          aria-label={identity.authenticated ? 'AUREVANE game home' : 'AUREVANE account entry home'}
        >
          <span className="brand__crest" aria-hidden="true">
            <span>A</span>
          </span>
          <span className="brand__wordmark">
            <strong>AUREVANE</strong>
            <small>Public field guide</small>
          </span>
        </Link>

        <nav
          className={`${styles.mastheadNav} ${headerLayout.centerNav}`}
          aria-label="Public information"
        >
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
        </nav>

        <Link className={`${styles.playLink} ${headerLayout.endAction}`} href={gameHref}>
          {gameLabel}
        </Link>
      </header>

      <main className={styles.main} id="public-information-main">
        {children}
      </main>
    </div>
  )
}
