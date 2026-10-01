import { Kicker, Surface } from '@aurevane/ui'

import { SiteHeader } from '@/components/shell/site-header'
import { AudioSettingsMenu } from '@/components/audio/audio-settings-menu'
import { AurevaneImage } from '@/components/media/aurevane-image'
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

      <SiteHeader
        className={styles.masthead}
        brandHref="#account-main"
        brandLabel="AUREVANE account entry home"
        utility={<AudioSettingsMenu />}
      />

      <main className={styles.main} id="account-main">
        <section className={styles.hero} aria-labelledby="aurevane-title">
          <AurevaneImage assetId="environment.adventure.threshold" className={styles.heroMedia} />
          <div className={styles.heroShade} aria-hidden="true" />
          <div className={styles.heroContent}>
            <Kicker marker="◆">A magical world. An unwritten legend.</Kicker>
            <h1 id="aurevane-title">AUREVANE</h1>
            <p>
              Beyond these gates, moonlit roads lead toward old powers, rival ambitions, and legends
              still unwritten. Return to your journey—or begin one.
            </p>
            <div className={styles.identityNotes} aria-label="Account foundations">
              <span>Your deeds endure</span>
              <span>Many paths await</span>
              <span>The world remembers</span>
            </div>
          </div>
        </section>

        <Surface
          className={styles.entryCard}
          tone="elevated"
          data-av-surface="moonstone"
          data-account-concept="true"
        >
          <Kicker marker="◇">Cross the threshold</Kicker>
          <h2>Your journey continues.</h2>
          <AccountAccessPanel authConfig={authConfig} initialMessage={sessionNotice} />
        </Surface>
      </main>

      <footer className={styles.footer}>
        <span>Your legend waits beyond the threshold</span>
      </footer>
    </div>
  )
}
