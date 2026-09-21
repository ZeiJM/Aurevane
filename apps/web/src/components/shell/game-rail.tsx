'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties } from 'react'

import { gameNavigation } from './game-navigation'
import styles from './authenticated-game-shell.module.css'

const RAIL_MANA_WISPS = [
  {
    left: '8%',
    width: '0.7rem',
    height: '5.6rem',
    duration: '29s',
    delay: '-6s',
    driftA: '0.35rem',
    driftB: '-0.18rem',
    driftC: '0.22rem',
    rgb: '119 239 232',
    opacity: '0.42',
    blur: '1.4px',
    rotate: '-5deg',
  },
  {
    left: '69%',
    width: '1.05rem',
    height: '8.2rem',
    duration: '38s',
    delay: '-25s',
    driftA: '-0.42rem',
    driftB: '0.28rem',
    driftC: '-0.3rem',
    rgb: '63 202 229',
    opacity: '0.34',
    blur: '2.1px',
    rotate: '6deg',
  },
  {
    left: '37%',
    width: '0.62rem',
    height: '6.4rem',
    duration: '26s',
    delay: '-15s',
    driftA: '-0.24rem',
    driftB: '0.4rem',
    driftC: '0.12rem',
    rgb: '146 247 239',
    opacity: '0.46',
    blur: '1.2px',
    rotate: '3deg',
  },
  {
    left: '82%',
    width: '0.48rem',
    height: '4.3rem',
    duration: '24s',
    delay: '-10s',
    driftA: '0.2rem',
    driftB: '-0.3rem',
    driftC: '0.36rem',
    rgb: '194 255 249',
    opacity: '0.5',
    blur: '0.9px',
    rotate: '-7deg',
  },
  {
    left: '20%',
    width: '1.2rem',
    height: '9.6rem',
    duration: '42s',
    delay: '-31s',
    driftA: '0.5rem',
    driftB: '-0.36rem',
    driftC: '0.18rem',
    rgb: '54 170 218',
    opacity: '0.28',
    blur: '2.8px',
    rotate: '5deg',
  },
  {
    left: '54%',
    width: '0.74rem',
    height: '7.2rem',
    duration: '32s',
    delay: '-19s',
    driftA: '-0.32rem',
    driftB: '-0.05rem',
    driftC: '0.43rem',
    rgb: '86 222 235',
    opacity: '0.4',
    blur: '1.7px',
    rotate: '-2deg',
  },
  {
    left: '13%',
    width: '0.88rem',
    height: '6.8rem',
    duration: '35s',
    delay: '-28s',
    driftA: '-0.16rem',
    driftB: '0.38rem',
    driftC: '-0.4rem',
    rgb: '74 205 214',
    opacity: '0.31',
    blur: '2px',
    rotate: '8deg',
  },
  {
    left: '88%',
    width: '0.66rem',
    height: '5.2rem',
    duration: '27s',
    delay: '-13s',
    driftA: '-0.4rem',
    driftB: '0.15rem',
    driftC: '-0.18rem',
    rgb: '132 245 238',
    opacity: '0.43',
    blur: '1.3px',
    rotate: '-4deg',
  },
  {
    left: '46%',
    width: '1.35rem',
    height: '10.4rem',
    duration: '44s',
    delay: '-34s',
    driftA: '0.26rem',
    driftB: '-0.48rem',
    driftC: '0.34rem',
    rgb: '46 159 207',
    opacity: '0.25',
    blur: '3.2px',
    rotate: '4deg',
  },
  {
    left: '30%',
    width: '0.54rem',
    height: '4.8rem',
    duration: '25s',
    delay: '-17s',
    driftA: '0.4rem',
    driftB: '0.08rem',
    driftC: '-0.24rem',
    rgb: '207 255 252',
    opacity: '0.48',
    blur: '1px',
    rotate: '-6deg',
  },
] as const

function RailManaField() {
  return (
    <div className={styles.railManaField} aria-hidden="true">
      {RAIL_MANA_WISPS.map((wisp, index) => (
        <span
          key={index}
          className={styles.railManaWisp}
          data-mana-wisp="true"
          style={
            {
              '--mana-left': wisp.left,
              '--mana-width': wisp.width,
              '--mana-height': wisp.height,
              '--mana-duration': wisp.duration,
              '--mana-delay': wisp.delay,
              '--mana-drift-a': wisp.driftA,
              '--mana-drift-b': wisp.driftB,
              '--mana-drift-c': wisp.driftC,
              '--mana-rgb': wisp.rgb,
              '--mana-opacity': wisp.opacity,
              '--mana-blur': wisp.blur,
              '--mana-rotate': wisp.rotate,
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
