import { Kicker, Surface } from '@aurevane/ui'
import Link from 'next/link'

import { AudioSettingsMenu } from '@/components/audio/audio-settings-menu'
import { AurevaneImage } from '@/components/media/aurevane-image'
import publicStyles from '@/components/public-information/public-information-shell.module.css'
import type { BrowserSupabaseConfig } from '@/lib/supabase/client'

import { AccountAccessPanel } from './account-access-panel'
import styles from './account-entry-shell.module.css'

interface AccountEntryShellProps {
  authConfig: BrowserSupabaseConfig | null
}

export function AccountEntryShell({ authConfig }: AccountEntryShellProps) {
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
        <div className={publicStyles.accountHeaderActions}>
          <nav className={publicStyles.mastheadNav} aria-label="Public information">
            <Link className={publicStyles.navLink} href="/news">
              News
            </Link>
            <Link className={publicStyles.navLink} href="/manual">
              Manual
            </Link>
            <Link className={publicStyles.navLink} href="/rules">
              Rules
            </Link>
          </nav>
          <AudioSettingsMenu />
        </div>
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

          <AccountAccessPanel authConfig={authConfig} />

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
        <nav className={publicStyles.compactLinks} aria-label="Public information footer">
          <Link href="/news">News</Link>
          <Link href="/manual">Manual</Link>
          <Link href="/rules">Rules</Link>
          <a href="#account-main">Play / Sign In</a>
        </nav>
        <span>Server-authoritative account boundary</span>
      </footer>
    </div>
  )
}
