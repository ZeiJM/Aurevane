import type { PlayerProfile } from '@aurevane/game-core/player-profile'
import { GameButton, Kicker, StatusMark, Surface } from '@aurevane/ui'
import type { ReactNode } from 'react'

import { AudioSettingsMenu } from '@/components/audio/audio-settings-menu'

import styles from './authenticated-game-shell.module.css'

interface AuthenticatedGameShellProps {
  profile: PlayerProfile
}

interface AuthenticatedShellFrameProps {
  children: ReactNode
  sessionLabel: string
  footerLabel: string
}

export function AuthenticatedGameShell({ profile }: AuthenticatedGameShellProps) {
  const accountCreated = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(profile.createdAt))

  return (
    <AuthenticatedShellFrame
      sessionLabel="Verified session"
      footerLabel="Private profile // server verified"
    >
      <Surface className={styles.primaryCard} tone="elevated">
        <Kicker marker="◆">Your account is ready</Kicker>
        <h1>The road begins with identity.</h1>
        <p className={styles.lead}>
          This account now has one durable private player profile. Your character will remain a
          separate identity rather than being folded into account data.
        </p>

        <div className={styles.characterState} data-testid="character-state">
          <span>No character bound</span>
          <strong>Your account is ready for character creation.</strong>
          <p>
            Character creation is not open in this build yet. No placeholder character or future
            progression state has been created for you.
          </p>
          <GameButton type="button" disabled>
            Create character
          </GameButton>
        </div>
      </Surface>

      <aside className={styles.sideColumn}>
        <Surface className={styles.statusCard} tone="quiet">
          <Kicker marker={<StatusMark />}>Account state</Kicker>
          <dl>
            <div>
              <dt>Session</dt>
              <dd>Verified</dd>
            </div>
            <div>
              <dt>Private profile</dt>
              <dd>Ready</dd>
            </div>
            <div>
              <dt>Character</dt>
              <dd>Not created</dd>
            </div>
            <div>
              <dt>Account since</dt>
              <dd>{accountCreated}</dd>
            </div>
          </dl>
        </Surface>

        <AccountSecurityCard />
      </aside>
    </AuthenticatedShellFrame>
  )
}

export function AuthenticatedGameRecovery() {
  return (
    <AuthenticatedShellFrame
      sessionLabel="Verified session // service recovery"
      footerLabel="Private profile // recovery state"
    >
      <Surface className={styles.primaryCard} tone="elevated">
        <Kicker marker="◇">Account service interruption</Kicker>
        <h1>Your session is safe. The road is briefly closed.</h1>
        <p className={styles.lead}>
          AUREVANE verified your sign-in, but it could not safely load the private account profile
          required to enter the game. No character or progression state was changed.
        </p>

        <div className={styles.characterState} data-testid="persistence-recovery">
          <span>Private profile unavailable</span>
          <strong>Retry when account services are ready.</strong>
          <p>
            This can happen during maintenance or environment setup. Retry the account load, or sign
            out and return later. AUREVANE will not substitute another environment or create partial
            game state to bypass the problem.
          </p>
          <div className={styles.recoveryActions}>
            <form action="/game" method="get">
              <GameButton type="submit">Retry account load</GameButton>
            </form>
            <form action="/auth/signout" method="post">
              <GameButton type="submit" variant="quiet">
                Sign out
              </GameButton>
            </form>
          </div>
        </div>
      </Surface>

      <aside className={styles.sideColumn}>
        <Surface className={styles.statusCard} tone="quiet">
          <Kicker marker={<StatusMark />}>Account state</Kicker>
          <dl>
            <div>
              <dt>Session</dt>
              <dd>Verified</dd>
            </div>
            <div>
              <dt>Private profile</dt>
              <dd>Unavailable</dd>
            </div>
            <div>
              <dt>Game state</dt>
              <dd>Not loaded</dd>
            </div>
          </dl>
        </Surface>

        <AccountSecurityCard />
      </aside>
    </AuthenticatedShellFrame>
  )
}

function AuthenticatedShellFrame({
  children,
  sessionLabel,
  footerLabel,
}: AuthenticatedShellFrameProps) {
  return (
    <div className={styles.shell} data-testid="authenticated-shell">
      <a className="skip-link" href="#game-entry-main">
        Skip to account status
      </a>

      <header className={styles.masthead}>
        <a className="brand" href="/game" aria-label="AUREVANE authenticated home">
          <span className="brand__crest" aria-hidden="true">
            <span>A</span>
          </span>
          <span className="brand__wordmark">
            <strong>AUREVANE</strong>
            <small>Account established</small>
          </span>
        </a>
        <span className={styles.sessionState}>
          <StatusMark /> {sessionLabel}
        </span>
        <AudioSettingsMenu />
      </header>

      <main className={styles.main} id="game-entry-main">
        {children}
      </main>

      <footer className={styles.footer}>
        <span>AUREVANE // AUTHENTICATED DEVELOPMENT BUILD</span>
        <span>{footerLabel}</span>
      </footer>
    </div>
  )
}

function AccountSecurityCard() {
  return (
    <Surface className={styles.statusCard} tone="quiet">
      <Kicker marker="◇">Account &amp; Security</Kicker>
      <p>
        Private account data is loaded only for the authenticated session. Your sign-in email is
        never treated as a character name.
      </p>
      <form action="/auth/signout" method="post">
        <GameButton type="submit" variant="quiet">
          Sign out
        </GameButton>
      </form>
    </Surface>
  )
}
