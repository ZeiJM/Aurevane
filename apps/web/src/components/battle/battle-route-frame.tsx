import type { Route } from 'next'
import type { ReactNode } from 'react'

import { AccountMenu } from '@/components/shell/account-menu'
import { SiteHeader } from '@/components/shell/site-header'
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
      <SiteHeader
        className={styles.header}
        brandHref={sessionHref as Route}
        brandLabel="AUREVANE current battle"
        navigationLabel="Reference"
        utility={
          <AccountMenu activeSessionHref={sessionHref as Route} activeSessionLabel={sessionLabel} />
        }
      />
      <div className={styles.field}>{children}</div>
    </div>
  )
}
