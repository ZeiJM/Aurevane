'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties } from 'react'

import { gameNavigation } from './game-navigation'
import styles from './authenticated-game-shell.module.css'

const RAIL_MANA_STRANDS = [
  {
    left: '9%',
    width: '0.16rem',
    height: '9.4rem',
    duration: '32s',
    delay: '-8s',
    driftA: '0.42rem',
    driftB: '-0.28rem',
    driftC: '0.18rem',
    rgb: '125 240 235',
    opacity: '0.26',
    blur: '0.8px',
    rotate: '-7deg',
  },
  {
    left: '71%',
    width: '0.22rem',
    height: '11.8rem',
    duration: '44s',
    delay: '-29s',
    driftA: '-0.36rem',
    driftB: '0.22rem',
    driftC: '-0.3rem',
    rgb: '70 202 229',
    opacity: '0.19',
    blur: '1.3px',
    rotate: '8deg',
  },
  {
    left: '35%',
    width: '0.12rem',
    height: '7.6rem',
    duration: '29s',
    delay: '-16s',
    driftA: '-0.22rem',
    driftB: '0.35rem',
    driftC: '0.1rem',
    rgb: '178 251 246',
    opacity: '0.3',
    blur: '0.55px',
    rotate: '4deg',
  },
  {
    left: '84%',
    width: '0.14rem',
    height: '8.1rem',
    duration: '31s',
    delay: '-12s',
    driftA: '0.18rem',
    driftB: '-0.28rem',
    driftC: '0.33rem',
    rgb: '205 255 252',
    opacity: '0.28',
    blur: '0.5px',
    rotate: '-8deg',
  },
  {
    left: '18%',
    width: '0.28rem',
    height: '13.2rem',
    duration: '48s',
    delay: '-36s',
    driftA: '0.46rem',
    driftB: '-0.34rem',
    driftC: '0.2rem',
    rgb: '56 174 220',
    opacity: '0.16',
    blur: '1.55px',
    rotate: '6deg',
  },
  {
    left: '56%',
    width: '0.18rem',
    height: '10.5rem',
    duration: '39s',
    delay: '-23s',
    driftA: '-0.3rem',
    driftB: '-0.08rem',
    driftC: '0.41rem',
    rgb: '91 224 235',
    opacity: '0.22',
    blur: '1px',
    rotate: '-3deg',
  },
  {
    left: '12%',
    width: '0.2rem',
    height: '9.9rem',
    duration: '42s',
    delay: '-31s',
    driftA: '-0.14rem',
    driftB: '0.36rem',
    driftC: '-0.36rem',
    rgb: '78 207 218',
    opacity: '0.18',
    blur: '1.15px',
    rotate: '9deg',
  },
  {
    left: '90%',
    width: '0.13rem',
    height: '7.2rem',
    duration: '30s',
    delay: '-14s',
    driftA: '-0.38rem',
    driftB: '0.14rem',
    driftC: '-0.16rem',
    rgb: '139 246 240',
    opacity: '0.27',
    blur: '0.65px',
    rotate: '-5deg',
  },
  {
    left: '47%',
    width: '0.34rem',
    height: '14.5rem',
    duration: '50s',
    delay: '-40s',
    driftA: '0.24rem',
    driftB: '-0.46rem',
    driftC: '0.32rem',
    rgb: '48 162 209',
    opacity: '0.14',
    blur: '1.8px',
    rotate: '4deg',
  },
  {
    left: '29%',
    width: '0.11rem',
    height: '6.8rem',
    duration: '28s',
    delay: '-18s',
    driftA: '0.38rem',
    driftB: '0.06rem',
    driftC: '-0.22rem',
    rgb: '215 255 253',
    opacity: '0.31',
    blur: '0.45px',
    rotate: '-7deg',
  },
  {
    left: '63%',
    width: '0.15rem',
    height: '8.8rem',
    duration: '36s',
    delay: '-25s',
    driftA: '-0.2rem',
    driftB: '0.3rem',
    driftC: '-0.1rem',
    rgb: '105 231 240',
    opacity: '0.24',
    blur: '0.75px',
    rotate: '5deg',
  },
  {
    left: '24%',
    width: '0.24rem',
    height: '12.4rem',
    duration: '46s',
    delay: '-33s',
    driftA: '0.32rem',
    driftB: '-0.25rem',
    driftC: '0.38rem',
    rgb: '66 192 226',
    opacity: '0.17',
    blur: '1.4px',
    rotate: '-4deg',
  },
] as const

function RailManaField() {
  return (
    <div className={styles.railManaField} aria-hidden="true">
      {RAIL_MANA_STRANDS.map((strand, index) => (
        <span
          key={index}
          className={styles.railManaStrand}
          data-mana-strand="true"
          style={
            {
              '--mana-left': strand.left,
              '--mana-width': strand.width,
              '--mana-height': strand.height,
              '--mana-duration': strand.duration,
              '--mana-delay': strand.delay,
              '--mana-drift-a': strand.driftA,
              '--mana-drift-b': strand.driftB,
              '--mana-drift-c': strand.driftC,
              '--mana-rgb': strand.rgb,
              '--mana-opacity': strand.opacity,
              '--mana-blur': strand.blur,
              '--mana-rotate': strand.rotate,
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
      <RailManaField />
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
