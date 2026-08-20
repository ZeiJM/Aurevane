import { Kicker, StatusMark, Surface } from '@aurevane/ui'
import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { CharacterPortraitImage } from '@/components/character/character-portrait-image'
import railStyles from '@/components/public-information/public-header-rail.module.css'
import { AccountMenu } from '@/components/shell/account-menu'
import { NavigationMenu } from '@/components/shell/navigation-menu'
import { OnlinePresenceLink } from '@/components/shell/online-presence-link'
import { getStarterPortraitImageAssetId } from '@/media/character'
import { getActiveBattleForUser } from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import {
  listOnlineCharacters,
  touchCharacterPresence,
} from '@/server/presence/character-presence-service'

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
  let activeImageUrl: string | null = null
  let activeBattleHref: Route | null = null
  let onlineCount = 0
  try {
    const actor = await getAuthenticatedActor()
    const activeBattle = await getActiveBattleForUser(actor.userId).catch(() => null)
    activeBattleHref = activeBattle
      ? (`/game/battle/${activeBattle.battleSessionId}` as Route)
      : null
    activeCharacter = await loadSelectedCharacter(actor)
    if (activeCharacter) {
      try {
        const [display, online] = await Promise.all([
          loadCharacterProfileDisplay(actor.userId, activeCharacter.id),
          (async () => {
            await touchCharacterPresence(actor.userId, activeCharacter.id)
            return listOnlineCharacters()
          })(),
        ])
        activeImageUrl = display.imageUrl
        onlineCount = online.length
      } catch {
        // Profile display and presence are supplementary. The authenticated shell remains usable.
      }
    }
  } catch {
    activeCharacter = null
  }

  return (
    <div className={styles.shell} data-testid="authenticated-shell">
      <a className="skip-link" href="#game-main">
        Skip to game content
      </a>
      <header className={`${styles.masthead} ${railStyles.masthead}`}>
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

        {activeBattleHref ? (
          <Link className={styles.activeBattleLink} href={activeBattleHref}>
            <span aria-hidden="true">●</span> IN BATTLE
          </Link>
        ) : null}

        <nav
          className={`${styles.headerLinks} ${railStyles.navigation}`}
          style={{ marginRight: 0 }}
          aria-label="Reference"
        >
          <Link href="/news">News</Link>
          <Link href="/manual">Manual</Link>
          <Link href="/rules">Rules</Link>
        </nav>

        <div className={railStyles.utility}>
          <div className={styles.screenIdentity} aria-label={`Current screen: ${sessionLabel}`}>
            {activeCharacter ? (
              <span className={styles.screenPortrait} title={activeCharacter.name}>
                <CharacterPortraitImage
                  imageUrl={activeImageUrl}
                  fallbackAssetId={getStarterPortraitImageAssetId(activeCharacter.portraitRef)}
                  className={styles.screenPortraitImage}
                  sizes="2rem"
                  alt=""
                />
              </span>
            ) : null}
            <span className={styles.screenLabel}>
              <StatusMark />
              <strong>{sessionLabel}</strong>
            </span>
          </div>

          <AccountMenu activeBattleHref={activeBattleHref} />
        </div>
      </header>

      <main className={styles.main} id="game-main">
        {children}
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerBalance} aria-hidden="true" />
        <OnlinePresenceLink initialCount={onlineCount} />
        <NavigationMenu />
      </footer>
    </div>
  )
}
