'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties } from 'react'

import { gameNavigation } from './game-navigation'
import styles from './authenticated-game-shell.module.css'

const RAIL_AETHER_ORBS = [
  {
    left: '8%',
    size: '0.52rem',
    duration: '35s',
    delay: '-8s',
    driftA: '0.34rem',
    driftB: '-0.18rem',
    driftC: '0.24rem',
    rgb: '136 238 235',
    opacity: '0.3',
    blur: '0.2px',
  },
  {
    left: '66%',
    size: '0.86rem',
    duration: '47s',
    delay: '-31s',
    driftA: '-0.26rem',
    driftB: '0.18rem',
    driftC: '-0.32rem',
    rgb: '82 199 224',
    opacity: '0.23',
    blur: '0.35px',
  },
  {
    left: '28%',
    size: '0.38rem',
    duration: '31s',
    delay: '-17s',
    driftA: '-0.16rem',
    driftB: '0.29rem',
    driftC: '0.1rem',
    rgb: '190 252 248',
    opacity: '0.34',
    blur: '0.15px',
  },
  {
    left: '73%',
    size: '1.08rem',
    duration: '51s',
    delay: '-39s',
    driftA: '0.22rem',
    driftB: '-0.34rem',
    driftC: '0.29rem',
    rgb: '111 220 232',
    opacity: '0.2',
    blur: '0.45px',
  },
  {
    left: '17%',
    size: '0.68rem',
    duration: '41s',
    delay: '-26s',
    driftA: '0.38rem',
    driftB: '-0.24rem',
    driftC: '0.16rem',
    rgb: '63 174 211',
    opacity: '0.22',
    blur: '0.4px',
  },
  {
    left: '49%',
    size: '0.46rem',
    duration: '36s',
    delay: '-21s',
    driftA: '-0.21rem',
    driftB: '-0.08rem',
    driftC: '0.36rem',
    rgb: '103 225 234',
    opacity: '0.29',
    blur: '0.2px',
  },
  {
    left: '4%',
    size: '0.96rem',
    duration: '53s',
    delay: '-43s',
    driftA: '-0.12rem',
    driftB: '0.32rem',
    driftC: '-0.28rem',
    rgb: '74 194 216',
    opacity: '0.18',
    blur: '0.5px',
  },
  {
    left: '82%',
    size: '0.34rem',
    duration: '30s',
    delay: '-14s',
    driftA: '-0.31rem',
    driftB: '0.11rem',
    driftC: '-0.14rem',
    rgb: '205 255 252',
    opacity: '0.36',
    blur: '0.12px',
  },
  {
    left: '41%',
    size: '0.76rem',
    duration: '45s',
    delay: '-34s',
    driftA: '0.18rem',
    driftB: '-0.39rem',
    driftC: '0.27rem',
    rgb: '56 166 207',
    opacity: '0.2',
    blur: '0.4px',
  },
  {
    left: '23%',
    size: '0.42rem',
    duration: '33s',
    delay: '-19s',
    driftA: '0.31rem',
    driftB: '0.05rem',
    driftC: '-0.17rem',
    rgb: '219 255 253',
    opacity: '0.34',
    blur: '0.14px',
  },
  {
    left: '58%',
    size: '1.16rem',
    duration: '55s',
    delay: '-46s',
    driftA: '-0.18rem',
    driftB: '0.24rem',
    driftC: '-0.08rem',
    rgb: '91 210 225',
    opacity: '0.17',
    blur: '0.55px',
  },
  {
    left: '35%',
    size: '0.58rem',
    duration: '39s',
    delay: '-28s',
    driftA: '0.25rem',
    driftB: '-0.2rem',
    driftC: '0.31rem',
    rgb: '126 232 237',
    opacity: '0.26',
    blur: '0.28px',
  },
] as const

function RailAetherField() {
  return (
    <div className={styles.railAetherField} aria-hidden="true">
      {RAIL_AETHER_ORBS.map((orb, index) => (
        <span
          key={index}
          className={styles.railAetherOrb}
          data-aether-orb="true"
          style={
            {
              '--orb-left': orb.left,
              '--orb-size': orb.size,
              '--orb-duration': orb.duration,
              '--orb-delay': orb.delay,
              '--orb-drift-a': orb.driftA,
              '--orb-drift-b': orb.driftB,
              '--orb-drift-c': orb.driftC,
              '--orb-rgb': orb.rgb,
              '--orb-opacity': orb.opacity,
              '--orb-blur': orb.blur,
            } as CSSProperties
          }
        />
      ))}
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
      ) : name === 'arsenal' ? (
        <>
          <path d="M12 3 18 5.5v5.2c0 3.7-2.4 7-6 9.3-3.6-2.3-6-5.6-6-9.3V5.5L12 3Z" />
          <path d="m9 15 6-6M13.8 8.2l2 2M8.3 13.7l2 2" />
        </>
      ) : name === 'battle' ? (
        <>
          <path d="m4 3 4 1 12 15-2 2L4 7V3Zm16 0-4 1-5 6M4 19l5-6M2 17l5 5m10 0 5-5" />
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
  activeSessionHref?: Route | null
  activeSessionLabel?: string | null
}

export function GameRail({ activeSessionHref, activeSessionLabel }: GameRailProps) {
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
      <nav className={styles.railNavigation} aria-label="Primary game navigation">
        {gameNavigation.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
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
      {activeSessionHref ? (
        <Link className={styles.railSession} href={activeSessionHref}>
          {activeSessionLabel ?? 'Return to Active Session'}
        </Link>
      ) : null}
    </aside>
  )
}
