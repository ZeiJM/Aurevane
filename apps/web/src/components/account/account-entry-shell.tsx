import { Kicker, Surface } from '@aurevane/ui'

import { AudioSettingsMenu } from '@/components/audio/audio-settings-menu'
import { AurevaneImage } from '@/components/media/aurevane-image'

import { AccountAccessPanel } from './account-access-panel'
import styles from './account-entry-shell.module.css'

interface AccountEntryShellProps {
  authAvailable: boolean
}

export function AccountEntryShell({ authAvailable }: AccountEntryShellProps) {
  return (
    <div className={styles.shell} data-testid="account-shell">
      <a className="skip-link" href="#account-main">
        Skip to account entry
      </a>

      <header className={styles.masthead}>
        <a className="brand" href="#account-main" aria-label="AUREVANE account entry home">
          <span className="brand__crest" aria-hidden="true">
            <span>A</span>
          </span>
          <span className="brand__wordmark">
            <strong>AUREVANE</strong>
            <small>Persistent tactical fantasy</small>
          </span>
        </a>
        <span className={styles.environmentMark}>Account gateway</span>
        <AudioSettingsMenu />
      </header>

      <main className={styles.main} id="account-main">
        <section className={styles.hero} aria-labelledby="aurevane-title">
          <AurevaneImage assetId="ui.foundation.vista" className={styles.heroMedia} />
          <div className={styles.heroShade} aria-hidden="true" />
          <div className={styles.heroContent}>
            <Kicker marker="◆">One account // one persistent history</Kicker>
            <h1 id="aurevane-title">AUREVANE</h1>
            <p>
              Enter the account that will anchor your character, settings, and history across a
              persistent tactical fantasy world.
            </p>
            <div className={styles.identityNotes} aria-label="Account foundations">
              <span>Verified sessions</span>
              <span>Private account profile</span>
              <span>Character identity stays distinct</span>
            </div>
          </div>
          <div className={styles.mediaStatus} aria-label="Production artwork status">
            <span>Title vista</span>
            <strong>ART-UI-001</strong>
            <em>Requested</em>
          </div>
        </section>

        <Surface className={styles.entryCard} tone="elevated">
          <Kicker marker="◇">Account entry</Kicker>
          <h2>Begin or return.</h2>
          <p className={styles.entryLead}>
            Sign in to resume your account, or create the account that will carry your AUREVANE
            history forward.
          </p>

          <AccountAccessPanel authAvailable={authAvailable} />

          <details className={styles.help}>
            <summary>Account &amp; Security</summary>
            <div>
              <p>
                AUREVANE verifies your session before private account data is loaded. Your email is
                authentication data, not your future character name.
              </p>
              <p>
                Some environments may require email confirmation after signup. Sign out when using a
                shared device.
              </p>
            </div>
          </details>
        </Surface>
      </main>

      <footer className={styles.footer}>
        <span>AUREVANE // DEVELOPMENT BUILD</span>
        <span>Server-authoritative account boundary</span>
      </footer>
    </div>
  )
}
