import { Kicker, Surface } from '@aurevane/ui'
import Link from 'next/link'

import { AudioSettingsMenu } from '@/components/audio/audio-settings-menu'
import { AurevaneImage } from '@/components/media/aurevane-image'
import railStyles from '@/components/public-information/public-header-rail.module.css'
import publicStyles from '@/components/public-information/public-information-shell.module.css'
import type { BrowserSupabaseConfig } from '@/lib/supabase/client'

import { AccountAccessPanel } from './account-access-panel'
import styles from './account-entry-shell.module.css'

interface AccountEntryShellProps {
  authConfig: BrowserSupabaseConfig | null
  sessionNotice?: string
}

export function AccountEntryShell({ authConfig, sessionNotice }: AccountEntryShellProps) {
  return (
    <div className={styles.shell} data-testid="account-shell">
      <a className="skip-link" href="#account-main">
        Skip to account entry
      </a>

      <header
        className={`${styles.masthead} ${railStyles.masthead}`}
        style={{ position: 'sticky', top: 0, zIndex: 700 }}
      >
        <a className="brand" href="#account-main" aria-label="AUREVANE account entry home">
          <span className="brand__crest" aria-hidden="true">
            <span>A</span>
          </span>
          <span className="brand__wordmark">
            <strong>AUREVANE</strong>
            <small>Persistent tactical fantasy</small>
          </span>
        </a>

        <nav
          className={`${publicStyles.mastheadNav} ${railStyles.navigation}`}
          aria-label="Public information"
        >
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

        <div className={railStyles.utility}>
          <span className={styles.environmentMark}>Account gateway</span>
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
        </section>

        <Surface
          className={styles.entryCard}
          tone="elevated"
          data-av-surface="moonstone"
          data-account-concept="true"
        >
          <Kicker marker="◇">Account entry</Kicker>
          <h2>Begin or return.</h2>
          <AccountAccessPanel authConfig={authConfig} initialMessage={sessionNotice} />
        </Surface>
      </main>

      <footer className={styles.footer}>
        <span>Server-authoritative account boundary</span>
      </footer>
    </div>
  )
}
