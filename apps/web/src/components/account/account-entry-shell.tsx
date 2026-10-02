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
    <div className={styles.shell} data-testid="account-shell" data-approved-entry="gateway">
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
        <div className={styles.scene} aria-hidden="true">
          <AurevaneImage assetId="environment.entry.gateway" />
        </div>
        <section className={styles.hero} aria-labelledby="aurevane-title">
          <div className={styles.heroMedia} aria-hidden="true" />
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
          <EntryFrame />
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

function EntryFrame() {
  return (
    <>
      <svg
        className={styles.frame}
        viewBox="0 0 500 560"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M3 3H497V557H3ZM9 9H491V551H9Z" />
        <path d="M18 40V18H40M18 18l22 22M18 31h13V18M460 18h22v22M482 18l-22 22M469 18v13h13M18 520v22h22M18 542l22-22M18 529h13v13M460 542h22v-22M482 542l-22-22M469 542v-13h13" />
        <path d="M42 14H215l35 16 35-16H458M42 546H458M14 42V518M486 42V518" />
      </svg>
      <svg className={styles.crest} viewBox="0 0 96 96" aria-hidden="true">
        <path d="M48 3 85 48 48 93 11 48ZM48 11 78 48 48 85 18 48Z" />
        <circle cx="48" cy="48" r="23" />
        <path d="M48 9v78M9 48h78M24 24l48 48M72 24 24 72M48 24l7 17 17 7-17 7-7 17-7-17-17-7 17-7Z" />
      </svg>
    </>
  )
}
