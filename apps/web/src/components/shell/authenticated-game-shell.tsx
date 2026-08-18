import { Kicker, StatusMark, Surface } from '@aurevane/ui'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { IdentityAvatar } from '@/components/account/identity-avatar'
import { AccountMenu } from '@/components/shell/account-menu'
import { NavigationMenu } from '@/components/shell/navigation-menu'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { loadPlayerProfile } from '@/server/player-profile/player-profile-service'
import { createSupabasePlayerProfileRepository } from '@/server/player-profile/supabase-player-profile-repository'

import styles from './authenticated-game-shell.module.css'

type CharacterBackRoute = '/game' | '/game/character' | '/game/battle'

interface AuthenticatedShellFrameProps {
  children: ReactNode
  sessionLabel?: string
  footerLabel?: string
  backHref?: CharacterBackRoute
  backLabel?: string
}

interface ShellIdentity {
  characterName: string | null
  avatarUrl: string | null
}

async function loadShellIdentity(): Promise<ShellIdentity> {
  try {
    const actor = await getAuthenticatedActor()
    const [character, profile] = await Promise.all([
      loadSelectedCharacter(actor),
      loadPlayerProfile(actor, createSupabasePlayerProfileRepository()),
    ])
    return {
      characterName: character?.name ?? null,
      avatarUrl: character ? profile.avatarUrl : null,
    }
  } catch {
    return { characterName: null, avatarUrl: null }
  }
}

export function AuthenticatedGameRecovery() {
  return (
    <AuthenticatedShellFrame sessionLabel="Service recovery">
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
  sessionLabel = 'Verified session',
  backHref,
  backLabel,
}: AuthenticatedShellFrameProps) {
  const identity = await loadShellIdentity()
  const statusLabel = identity.characterName ?? sessionLabel

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
              <span className={styles.crestContent}>
                <IdentityAvatar
                  src={identity.avatarUrl}
                  alt=""
                  className={styles.crestAvatar}
                  fallback="A"
                />
              </span>
            </span>
            <span className="brand__wordmark">
              <strong>AUREVANE</strong>
              <small>Persistent tactical fantasy</small>
            </span>
          </Link>
        </div>

        <span className={styles.sessionState} title={sessionLabel}>
          <StatusMark /> <strong>{statusLabel}</strong>
        </span>

        <nav className={styles.headerNav} aria-label="AUREVANE information">
          <Link href="/manual">Manual</Link>
          <Link href="/news">News</Link>
          <Link href="/rules">Rules</Link>
        </nav>

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
