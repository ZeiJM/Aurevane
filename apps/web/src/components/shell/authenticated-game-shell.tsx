import { getFoundationDiscipline } from '@aurevane/game-core/character/foundation-disciplines'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import type { PlayerProfile } from '@aurevane/game-core/player-profile'
import { GameButton, Kicker, StatusMark, Surface } from '@aurevane/ui'
import type { ReactNode } from 'react'

import { AudioSettingsMenu } from '@/components/audio/audio-settings-menu'
import { CharacterCreationExperience } from '@/components/character/character-creation-experience'

import styles from './authenticated-game-shell.module.css'

interface AuthenticatedGameShellProps {
  profile: PlayerProfile
  character: PersistedCharacter | null
}

interface AuthenticatedShellFrameProps {
  children: ReactNode
  sessionLabel: string
  footerLabel: string
}

export function AuthenticatedGameShell({ profile, character }: AuthenticatedGameShellProps) {
  const accountCreated = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(profile.createdAt))

  const discipline = character ? getFoundationDiscipline(character.foundationDisciplineId) : null

  return (
    <AuthenticatedShellFrame
      sessionLabel="Verified session"
      footerLabel="Private character state // server verified"
    >
      <Surface className={styles.primaryCard} tone="elevated">
        {character ? (
          <div data-testid="character-established">
            <Kicker marker="◆">Character established</Kicker>
            <h1>{character.name}</h1>
            <p className={styles.lead}>
              Your base character is permanently bound to this account. Refreshing or signing back
              in returns to this same authoritative character state.
            </p>

            <div className={styles.characterState}>
              <span>Base slot // Level {character.level}</span>
              <strong>{discipline?.name ?? character.foundationDisciplineId}</strong>
              <p>
                {discipline?.summary ?? 'Your first combat tradition is established.'} Your full
                character profile now calculates attributes and derived stats from authoritative
                server state.
              </p>
              <dl className={styles.attributeSummary}>
                <div>
                  <dt>Might</dt>
                  <dd>{character.attributes.might}</dd>
                </div>
                <div>
                  <dt>Finesse</dt>
                  <dd>{character.attributes.finesse}</dd>
                </div>
                <div>
                  <dt>Intellect</dt>
                  <dd>{character.attributes.intellect}</dd>
                </div>
                <div>
                  <dt>Resolve</dt>
                  <dd>{character.attributes.resolve}</dd>
                </div>
              </dl>
              <a className={styles.profileLink} href="/game/character">
                Open character profile
              </a>
            </div>
          </div>
        ) : (
          <CharacterCreationExperience />
        )}
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
              <dd>{character ? character.name : 'Creation ready'}</dd>
            </div>
            {character ? (
              <div>
                <dt>Base slot</dt>
                <dd>Bound</dd>
              </div>
            ) : null}
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
      footerLabel="Private game state // recovery state"
    >
      <Surface className={styles.primaryCard} tone="elevated">
        <Kicker marker="◇">Game service interruption</Kicker>
        <h1>Your session is safe. The road is briefly closed.</h1>
        <p className={styles.lead}>
          AUREVANE verified your sign-in, but it could not safely load the private account and
          character state required to enter the game. No character or progression state was changed.
        </p>

        <div className={styles.characterState} data-testid="persistence-recovery">
          <span>Private game state unavailable</span>
          <strong>Retry when account services are ready.</strong>
          <p>
            This can happen during maintenance or environment setup. Retry the private-state load,
            or sign out and return later. AUREVANE will not substitute another environment or create
            partial character state to bypass the problem.
          </p>
          <div className={styles.recoveryActions}>
            <form action="/game" method="get">
              <GameButton type="submit">Retry private-state load</GameButton>
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
              <dt>Private state</dt>
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

export function AuthenticatedShellFrame({
  children,
  sessionLabel,
  footerLabel,
}: AuthenticatedShellFrameProps) {
  return (
    <div className={styles.shell} data-testid="authenticated-shell">
      <a className="skip-link" href="#game-entry-main">
        Skip to game entry
      </a>

      <header className={styles.masthead}>
        <a className="brand" href="/game" aria-label="AUREVANE authenticated home">
          <span className="brand__crest" aria-hidden="true">
            <span>A</span>
          </span>
          <span className="brand__wordmark">
            <strong>AUREVANE</strong>
            <small>Character foundation</small>
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
        Private account and character data is loaded only for the authenticated session. Your
        sign-in email is never treated as a character name.
      </p>
      <form action="/auth/signout" method="post">
        <GameButton type="submit" variant="quiet">
          Sign out
        </GameButton>
      </form>
    </Surface>
  )
}
