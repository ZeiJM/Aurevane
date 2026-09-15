import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { StatusMark } from '@aurevane/ui'

import { PvpBattleKeyInputAssist } from '@/components/battle/pvp-battle-key-input-assist'
import { getImageAsset } from '@/media/registry'

import railStyles from '../public-information/public-header-rail.module.css'
import { AccountMenu } from './account-menu'
import { GameRail, type GameRailProps } from './game-rail'
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
  activeBattleHref?: Route | null
  activeSpectatingHref?: Route | null
}

/** Resolved presentation only. Authentication and session authority stay in AuthenticatedShellFrame. */
export function AuthenticatedShellPresentation({
  children,
  sessionLabel = 'Character Profile',
  layout = 'standard',
  character,
  characterPortrait,
  activeBattleHref = null,
  activeSpectatingHref = null,
  activeSessionHref = activeBattleHref ?? activeSpectatingHref,
  activeSessionLabel = null,
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
      >
        <PvpBattleKeyInputAssist />
        <a className="skip-link" href="#game-main">
          Skip to game content
        </a>
        <header className={`${styles.masthead} ${railStyles.masthead}`} data-av-surface="ink">
          <div className={styles.brandGroup}>
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

          <nav className={`${styles.headerLinks} ${railStyles.navigation}`} aria-label="Reference">
            <Link href="/news">News</Link>
            <Link href="/manual">Manual</Link>
            <Link href="/rules">Rules</Link>
          </nav>

          <div className={railStyles.utility}>
            <AccountMenu
              activeSessionHref={activeSessionHref}
              activeSessionLabel={activeSessionLabel}
            />
          </div>
        </header>

        <GameRail
          activeSessionHref={activeSessionHref}
          activeSessionLabel={activeSessionLabel}
          character={character}
          characterPortrait={characterPortrait}
        />

        <section
          className={styles.contextBar}
          data-av-context-strip="true"
          data-av-surface="ink"
          aria-label={`Current screen: ${sessionLabel}`}
        >
          <div className={styles.contextHeading}>
            <StatusMark />
            <span>Current workspace</span>
            <strong>{sessionLabel}</strong>
          </div>

          <div className={styles.contextUtility}>
            {activeBattleHref ? (
              <Link className={styles.activeBattleLink} href={activeBattleHref}>
                <span aria-hidden="true">●</span> IN BATTLE
              </Link>
            ) : activeSpectatingHref ? (
              <Link className={styles.activeBattleLink} href={activeSpectatingHref}>
                <span aria-hidden="true">●</span> SPECTATING
              </Link>
            ) : null}

            {character ? (
              <div
                className={styles.contextCharacter}
                aria-label={`Current character: ${character.name}, Level ${character.level}`}
              >
                {characterPortrait}
                <div>
                  <strong>{character.name}</strong>
                  <small>Level {character.level}</small>
                </div>
              </div>
            ) : null}
          </div>
        </section>

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
