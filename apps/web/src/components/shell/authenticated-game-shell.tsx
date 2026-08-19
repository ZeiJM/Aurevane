import { Kicker, StatusMark, Surface } from '@aurevane/ui'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'
import { AccountMenu } from '@/components/shell/account-menu'
import { NavigationMenu } from '@/components/shell/navigation-menu'
import { getStarterPortraitImageAssetId } from '@/media/character'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'

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
    <AuthenticatedShellFrame sessionLabel="Service Recovery">
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

export async function AuthenticatedShellFrame({
  children,
  sessionLabel = 'Character Profile',
  backHref,
  backLabel,
}: AuthenticatedShellFrameProps) {
  let activeCharacter = null
  try {
    const actor = await getAuthenticatedActor()
    activeCharacter = await loadSelectedCharacter(actor)
  } catch {
    activeCharacter = null
  }

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

        <nav className={styles.headerLinks} aria-label="Reference">
          <Link href="/manual">Manual</Link>
          <Link href="/news">News</Link>
          <Link href="/rules">Rules</Link>
        </nav>

        <div className={styles.screenIdentity} aria-label={`Current screen: ${sessionLabel}`}>
          {activeCharacter ? (
            <span className={styles.screenPortrait} title={activeCharacter.name}>
              <AurevaneImage
                assetId={getStarterPortraitImageAssetId(activeCharacter.portraitRef)}
                className={styles.screenPortraitImage}
                sizes="2rem"
              />
            </span>
          ) : null}
          <span className={styles.screenLabel}>
            <StatusMark />
            <strong>{sessionLabel}</strong>
          </span>
        </div>

        <AccountMenu />
      </header>

      <main className={styles.main} id="game-main">
        {children}
      </main>

      <footer className={styles.footer}>
        <NavigationMenu />
      </footer>
    </div>
  )
}
