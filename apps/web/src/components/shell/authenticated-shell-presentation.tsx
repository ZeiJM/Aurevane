import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { PvpBattleKeyInputAssist } from '@/components/battle/pvp-battle-key-input-assist'
import { getImageAsset } from '@/media/registry'

import railStyles from '../public-information/public-header-rail.module.css'
import { AccountMenu } from './account-menu'
import { GameRail, type GameRailProps } from './game-rail'
import { MobileShellInsets } from './mobile-shell-insets'
import { OnlinePresenceLink } from './online-presence-link'
import styles from './authenticated-game-shell.module.css'

const worldBackdrop = getImageAsset('ui.foundation.vista')
const mobileWorldBackdrop = getImageAsset('ui.foundation.vista-mobile')

export interface AuthenticatedShellPresentationProps extends GameRailProps {
  children: ReactNode
  sessionLabel?: string
  backHref?: '/game' | '/game/character'
  backLabel?: string
  layout?: 'standard' | 'battlefield'
  character?: { name: string; level?: number } | null
  characterPortrait?: ReactNode
  railIdentity?: ReactNode
  activeBattleHref?: Route | null
  activeSpectatingHref?: Route | null
  masterPanelHref?: Route | null
}

/** Resolved presentation only. Authentication and session authority stay in AuthenticatedShellFrame. */
export function AuthenticatedShellPresentation({
  children,
  layout = 'standard',
  character,
  characterPortrait,
  railIdentity,
  activeBattleHref = null,
  activeSpectatingHref = null,
  activeSessionHref = activeBattleHref ?? activeSpectatingHref,
  activeSessionLabel = null,
  masterPanelHref = null,
}: AuthenticatedShellPresentationProps) {
  return (
    <div className={styles.worldFrame}>
      <picture className={styles.worldBackdrop}>
        <source media="(max-width: 760px)" srcSet={mobileWorldBackdrop.src} />
        {/* Registry-owned compressed artwork uses picture for a deliberate mobile crop. */}
        <img
          src={worldBackdrop.src}
          width={worldBackdrop.width}
          height={worldBackdrop.height}
          alt=""
          decoding="async"
          fetchPriority="low"
        />
      </picture>
      <div
        className={styles.shell}
        data-testid="authenticated-shell"
        data-av-shell="concept"
        data-av-layout={layout}
        data-av-session-restricted={Boolean(activeSessionHref) || undefined}
      >
        <PvpBattleKeyInputAssist />
        {layout === 'standard' ? <MobileShellInsets /> : null}
        <a className="skip-link" href="#game-main">
          Skip to game content
        </a>
        <header className={`${styles.masthead} ${railStyles.masthead}`} data-av-surface="ink">
          <div className={styles.brandGroup}>
            <Link className="brand" href="/game/haven" prefetch={false} aria-label="AUREVANE Haven">
              <span className="brand__crest" aria-hidden="true">
                <span>A</span>
              </span>
              <span className="brand__wordmark">
                <strong>AUREVANE</strong>
                <small>Persistent tactical fantasy</small>
              </span>
            </Link>
          </div>

          <nav className={`${styles.headerLinks} ${railStyles.navigation}`} aria-label="Reference">
            <Link href="/news" prefetch={false}>
              News
            </Link>
            <Link href="/manual" prefetch={false}>
              Manual
            </Link>
            <Link href="/rules" prefetch={false}>
              Rules
            </Link>
          </nav>

          <div className={`${railStyles.utility} ${styles.mastheadUtility}`}>
            {activeBattleHref ? (
              <Link className={styles.activeBattleLink} href={activeBattleHref} prefetch={false}>
                <span aria-hidden="true">●</span> IN BATTLE
              </Link>
            ) : activeSpectatingHref ? (
              <Link
                className={styles.activeBattleLink}
                href={activeSpectatingHref}
                prefetch={false}
              >
                <span aria-hidden="true">●</span> SPECTATING
              </Link>
            ) : null}
            {character ? (
              <div
                className={styles.headerCharacter}
                aria-label={`Current character: ${character.name}`}
              >
                {characterPortrait}
              </div>
            ) : null}
            <AccountMenu
              activeSessionHref={activeSessionHref}
              activeSessionLabel={activeSessionLabel}
              characterName={character?.name ?? null}
              masterPanelHref={masterPanelHref}
            />
          </div>
        </header>

        {layout !== 'battlefield' ? (
          <GameRail
            activeSessionHref={activeSessionHref}
            activeSessionLabel={activeSessionLabel}
            characterIdentity={
              railIdentity ??
              (character ? (
                <div className="av-rail-identity">
                  {characterPortrait}
                  <strong>{character.name}</strong>
                  {character.level ? <small>Level {character.level}</small> : null}
                  <span>Your journey continues</span>
                </div>
              ) : null)
            }
          />
        ) : null}

        <main className={styles.main} id="game-main" tabIndex={-1}>
          {children}
        </main>

        <footer className={styles.footer} data-av-surface="ink">
          <OnlinePresenceLink />
        </footer>
      </div>
    </div>
  )
}
