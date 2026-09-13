import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { AccountMenu } from '@/components/shell/account-menu'
import { GameRail } from '@/components/shell/game-rail'
import styles from './battle-route-frame.module.css'

/** Chrome only: the child battlefield remains the sole main and interaction root. */
export function BattleRouteFrame({
  children,
  sessionHref,
  spectating = false,
}: {
  children: ReactNode
  sessionHref: `/game/battle/${string}`
  spectating?: boolean
}) {
  const sessionLabel = spectating ? 'Return to Spectated Battle' : 'Return to Active Battle'
  return (
    <div className={styles.frame} data-battle-route-frame="true">
      <a className="skip-link" href="#battlefield">
        Skip to battlefield
      </a>
      <header className={styles.masthead} data-av-surface="ink">
        <Link
          className={styles.brandLink}
          href={sessionHref as Route}
          aria-label="AUREVANE current battle"
        >
          <span className="brand__crest" aria-hidden="true">
            <span>A</span>
          </span>
          <span className="brand__wordmark">
            <strong>AUREVANE</strong>
            <small>Persistent tactical fantasy</small>
          </span>
        </Link>
        <nav aria-label="Reference">
          <Link href="/news">News</Link>
          <Link href="/manual">Manual</Link>
          <Link href="/rules">Rules</Link>
        </nav>
        <AccountMenu activeSessionHref={sessionHref as Route} activeSessionLabel={sessionLabel} />
      </header>
      <GameRail activeSessionHref={sessionHref as Route} activeSessionLabel={sessionLabel} />
      <div className={styles.field}>{children}</div>
    </div>
  )
}
