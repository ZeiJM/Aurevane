import { Kicker, StatusMark, Surface } from '@aurevane/ui'
import Link from 'next/link'
import type { ReactNode } from 'react'

import publicStyles from '@/components/public-information/public-information-shell.module.css'
import { AccountMenu } from '@/components/shell/account-menu'

import styles from './authenticated-game-shell.module.css'

type CharacterBackRoute = '/game' | '/game/character'

interface AuthenticatedShellFrameProps {
  children: ReactNode
  sessionLabel?: string
  footerLabel?: string
  backHref?: CharacterBackRoute
  backLabel?: string
}

export function AuthenticatedGameRecovery() {
  return (
    <AuthenticatedShellFrame
      sessionLabel="Service recovery"
      footerLabel="Private game state unavailable"
    >
      <Surface className={styles.primaryCard} tone="elevated">
        <Kicker marker="◇">Game service interruption</Kicker>
        <h1>Your session is safe. The road is briefly closed.</h1>
        <p className={styles.lead}>
          AUREVANE verified your sign-in, but it could not safely load the private account and
          character state required to continue. No character or progression state was changed.
        </p>
        <div className={styles.characterState} data-testid="persistence-recovery">
          <span>Private game state unavailable</span>
          <strong>Retry when account services are ready.</strong>
          <p>
            Retry the private-state load, or use Account to sign out. AUREVANE will not create
            partial character state to bypass the problem.
          </p>
          <form action="/game" method="get">
            <button type="submit">Retry private-state load</button>
          </form>
        </div>
      </Surface>
    </AuthenticatedShellFrame>
  )
}

export function AuthenticatedShellFrame({
  children,
  sessionLabel = 'Verified session',
  footerLabel = 'AUREVANE',
  backHref,
  backLabel,
}: AuthenticatedShellFrameProps) {
  return (
    <div className={styles.shell} data-testid="authenticated-shell">
      <a className="skip-link" href="#game-main">
        Skip to game content
      </a>
      <header className={styles.masthead}>
        <div className={styles.brandGroup}>
          {backHref ? (
            <Link className={styles.backButton} href={backHref} aria-label={backLabel ?? 'Back'}>
              ←
            </Link>
          ) : null}
          <Link className="brand" href="/game/character" aria-label="AUREVANE character profile">
            <span className="brand__crest" aria-hidden="true">
              <span>A</span>
            </span>
            <span className="brand__wordmark">
              <strong>AUREVANE</strong>
              <small>Persistent tactical fantasy</small>
            </span>
          </Link>
        </div>
        <span className={styles.sessionState}>
          <StatusMark /> {sessionLabel}
        </span>
        <AccountMenu />
      </header>

      <main className={styles.main} id="game-main">
        {children}
      </main>

      <footer className={styles.footer}>
        <nav className={publicStyles.compactLinks} aria-label="Game navigation">
          <Link href="/game/character">Profile</Link>
          <Link href="/game/battle">Tactical Hall</Link>
          <Link href="/game/settings/controls">Controls</Link>
          <Link href="/game/training">Offline Training</Link>
          <Link href="/manual">Manual</Link>
        </nav>
        <span>{footerLabel}</span>
      </footer>
    </div>
  )
}
