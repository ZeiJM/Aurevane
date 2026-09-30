'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { gameNavigation } from './game-navigation'
import styles from './authenticated-game-shell.module.css'

function RailAetherField() {
  return (
    <div className={styles.railAetherField} aria-hidden="true">
      <span className={styles.railAetherWisp} data-aether-wisp="true" />
      <span className={styles.railAetherWisp} data-aether-wisp="true" />
      <svg className={styles.railAetherRunes} viewBox="0 0 190 640" data-aether-runes="true">
        <path d="m18 55 8 14-8 14-8-14Z M18 83v56m0 9v55m-7-38 14 14m-14 0 14-14 M167 330v84m-9-62 18 20-18 20m9 22v44 M42 480l12 20-12 20-12-20Z M42 520v42m-8 14 8 14 8-14" />
      </svg>
    </div>
  )
}

function NavigationIcon({ name }: { name: (typeof gameNavigation)[number]['icon'] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      data-nav-icon={name}
      aria-hidden="true"
    >
      {name === 'profile' ? (
        <>
          <circle cx="12" cy="7" r="3.25" />
          <path d="M5 21v-3a7 7 0 0 1 14 0v3Z" />
        </>
      ) : name === 'haven' ? (
        <>
          <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7" />
        </>
      ) : name === 'nexus' ? (
        <>
          <circle cx="12" cy="12" r="2.6" />
          <path d="M12 2v5m0 10v5M2 12h5m10 0h5M5 5l3.5 3.5m7 7L19 19M19 5l-3.5 3.5m-7 7L5 19" />
        </>
      ) : name === 'battle' ? (
        <>
          <path d="m4 3 4 1 12 15-2 2L4 7V3Zm16 0-4 1-5 6M4 19l5-6M2 17l5 5m10 0 5-5" />
        </>
      ) : name === 'world' ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="m15.5 8.5-2 5-5 2 2-5 5-2ZM12 1v4m0 14v4M1 12h4m14 0h4" />
        </>
      ) : name === 'training' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v6l4 2M8 2h8" />
        </>
      ) : (
        <>
          <circle cx="12" cy="7" r="3" />
          <path d="M7 21v-4a5 5 0 0 1 10 0v4ZM5 6a3 3 0 0 0 0 6m14-6a3 3 0 0 1 0 6M4 14a4 4 0 0 0-3 4v2h3m16 0h3v-2a4 4 0 0 0-3-4" />
        </>
      )}
    </svg>
  )
}

export interface GameRailProps {
  characterIdentity?: ReactNode
  activeSessionHref?: Route | null
  activeSessionLabel?: string | null
}

export function GameRail({
  activeSessionHref,
  activeSessionLabel,
  characterIdentity,
}: GameRailProps) {
  const pathname = usePathname()
  const restricted = Boolean(activeSessionHref)
  return (
    <aside
      className={styles.rail}
      data-av-game-rail
      data-av-primary-dock="true"
      data-av-surface="ink"
    >
      <RailAetherField />
      {characterIdentity ? <div className={styles.railCharacter}>{characterIdentity}</div> : null}
      <nav className={styles.railNavigation} aria-label="Primary game navigation">
        {gameNavigation.map((item) => {
          const active = Boolean(
            item.href &&
            (pathname === item.href ||
              pathname.startsWith(item.href + '/') ||
              (item.href === '/game/loadout' &&
                (pathname.startsWith('/game/nexus') || pathname.startsWith('/game/arsenal')))),
          )
          return restricted ? (
            <button
              key={item.href}
              className={styles.railLink}
              type="button"
              disabled
              title="Navigation is restricted until your active session ends"
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ) : (
            <Link
              key={item.href}
              prefetch={false}
              className={styles.railLink}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              title={item.detail}
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      {!restricted ? (
        <div className={styles.railUtilities}>
          <Link href="/game/account/titles" prefetch={false}>
            ♜ <span>Titles</span>
          </Link>
          <Link href="/game/settings/audio" prefetch={false}>
            ♫ <span>Audio</span>
          </Link>
          <Link href="/game/settings/controls" prefetch={false}>
            ⚙ <span>Controls</span>
          </Link>
        </div>
      ) : null}
      {activeSessionHref ? (
        <Link className={styles.railSession} href={activeSessionHref} prefetch={false}>
          {activeSessionLabel ?? 'Return to Active Session'}
        </Link>
      ) : null}
    </aside>
  )
}
