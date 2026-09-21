'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties } from 'react'

import { gameNavigation } from './game-navigation'
import styles from './authenticated-game-shell.module.css'

const RAIL_AETHER_BUBBLES = [
  {
    left: '9%',
    size: '0.26rem',
    duration: '13.4s',
    delay: '-2.1s',
    driftA: '0.38rem',
    driftB: '-0.18rem',
    driftC: '0.26rem',
    rgb: '164 247 240',
    opacity: '0.72',
    blur: '0px',
  },
  {
    left: '72%',
    size: '0.58rem',
    duration: '18.7s',
    delay: '-11.3s',
    driftA: '-0.44rem',
    driftB: '0.22rem',
    driftC: '-0.31rem',
    rgb: '73 218 229',
    opacity: '0.58',
    blur: '0.2px',
  },
  {
    left: '41%',
    size: '0.36rem',
    duration: '15.2s',
    delay: '-7.8s',
    driftA: '-0.21rem',
    driftB: '0.49rem',
    driftC: '0.11rem',
    rgb: '111 236 224',
    opacity: '0.66',
    blur: '0px',
  },
  {
    left: '84%',
    size: '0.2rem',
    duration: '11.8s',
    delay: '-4.4s',
    driftA: '0.19rem',
    driftB: '-0.37rem',
    driftC: '0.42rem',
    rgb: '190 255 249',
    opacity: '0.82',
    blur: '0px',
  },
  {
    left: '24%',
    size: '0.74rem',
    duration: '21.6s',
    delay: '-15.7s',
    driftA: '0.52rem',
    driftB: '-0.33rem',
    driftC: '0.16rem',
    rgb: '57 186 220',
    opacity: '0.46',
    blur: '0.35px',
  },
  {
    left: '58%',
    size: '0.31rem',
    duration: '14.1s',
    delay: '-9.6s',
    driftA: '-0.32rem',
    driftB: '-0.06rem',
    driftC: '0.48rem',
    rgb: '91 229 238',
    opacity: '0.7',
    blur: '0px',
  },
  {
    left: '15%',
    size: '0.46rem',
    duration: '17.3s',
    delay: '-12.4s',
    driftA: '-0.17rem',
    driftB: '0.41rem',
    driftC: '-0.46rem',
    rgb: '75 205 214',
    opacity: '0.55',
    blur: '0.15px',
  },
  {
    left: '91%',
    size: '0.4rem',
    duration: '16.2s',
    delay: '-5.9s',
    driftA: '-0.49rem',
    driftB: '0.14rem',
    driftC: '-0.2rem',
    rgb: '129 242 235',
    opacity: '0.68',
    blur: '0px',
  },
  {
    left: '48%',
    size: '0.88rem',
    duration: '24.5s',
    delay: '-19.1s',
    driftA: '0.31rem',
    driftB: '-0.51rem',
    driftC: '0.37rem',
    rgb: '50 170 211',
    opacity: '0.38',
    blur: '0.5px',
  },
  {
    left: '34%',
    size: '0.23rem',
    duration: '12.6s',
    delay: '-8.2s',
    driftA: '0.46rem',
    driftB: '0.08rem',
    driftC: '-0.27rem',
    rgb: '203 255 252',
    opacity: '0.86',
    blur: '0px',
  },
  {
    left: '67%',
    size: '0.5rem',
    duration: '19.4s',
    delay: '-3.8s',
    driftA: '0.14rem',
    driftB: '-0.43rem',
    driftC: '0.3rem',
    rgb: '67 199 230',
    opacity: '0.52',
    blur: '0.2px',
  },
  {
    left: '5%',
    size: '0.34rem',
    duration: '15.9s',
    delay: '-13.6s',
    driftA: '-0.28rem',
    driftB: '0.35rem',
    driftC: '0.07rem',
    rgb: '116 237 229',
    opacity: '0.64',
    blur: '0px',
  },
  {
    left: '78%',
    size: '0.67rem',
    duration: '22.1s',
    delay: '-17.2s',
    driftA: '0.43rem',
    driftB: '-0.15rem',
    driftC: '-0.39rem',
    rgb: '62 184 215',
    opacity: '0.43',
    blur: '0.4px',
  },
  {
    left: '52%',
    size: '0.18rem',
    duration: '10.9s',
    delay: '-6.7s',
    driftA: '-0.12rem',
    driftB: '0.3rem',
    driftC: '-0.33rem',
    rgb: '216 255 253',
    opacity: '0.9',
    blur: '0px',
  },
] as const

function RailAetherField() {
  return (
    <div className={styles.railAetherField} aria-hidden="true">
      {RAIL_AETHER_BUBBLES.map((bubble, index) => (
        <span
          key={index}
          className={styles.railAetherBubble}
          data-aether-bubble="true"
          style={
            {
              '--aether-left': bubble.left,
              '--aether-size': bubble.size,
              '--aether-duration': bubble.duration,
              '--aether-delay': bubble.delay,
              '--aether-drift-a': bubble.driftA,
              '--aether-drift-b': bubble.driftB,
              '--aether-drift-c': bubble.driftC,
              '--aether-rgb': bubble.rgb,
              '--aether-opacity': bubble.opacity,
              '--aether-blur': bubble.blur,
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
