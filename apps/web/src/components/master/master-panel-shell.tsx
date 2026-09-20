import Link from 'next/link'
import type { ReactNode } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'
import { OnlinePresenceLink } from '@/components/shell/online-presence-link'
import { AccountMenu } from '@/components/shell/account-menu'
import {
  hasMasterPanelCapability,
  type MasterPanelAccess,
  type MasterPanelCapability,
} from '@/server/master/staff-access'

import styles from './master-panel-shell.module.css'

export type MasterPanelSection = 'combat' | 'staff' | 'events' | 'live-events'

interface MasterPanelShellProps {
  access: MasterPanelAccess
  activeSection: MasterPanelSection
  title: string
  description: string
  children: ReactNode
}

const masterNavigation = [
  {
    id: 'combat',
    href: '/master/combat-content',
    label: 'Combat Content',
    detail: 'Skills & publication',
    icon: '⚔',
    capability: 'content.combat.author',
  },
  {
    id: 'staff',
    href: '/master/staff',
    label: 'Staff & Authority',
    detail: 'Roles & capabilities',
    icon: '♜',
    capability: 'staff.manage',
  },
  {
    id: 'events',
    href: '/master/events',
    label: 'Event Builder',
    detail: 'Draft & schedule',
    icon: '✧',
    capability: 'events.author',
  },
  {
    id: 'live-events',
    href: '/master/events/live',
    label: 'Live Event Ops',
    detail: 'Operate & recover',
    icon: '✦',
    capability: 'events.operate',
  },
] as const satisfies readonly {
  id: MasterPanelSection
  href:
    | '/master/combat-content'
    | '/master/staff'
    | '/master/events'
    | '/master/events/live'
  label: string
  detail: string
  icon: string
  capability: MasterPanelCapability | null
}[]

export function MasterPanelShell({
  access,
  activeSection,
  title,
  description,
  children,
}: MasterPanelShellProps) {
  const owner = access.roles.includes('game-owner')

  return (
    <div className={styles.worldFrame}>
      <div className={styles.shell} data-testid="master-panel-shell">
        <a className="skip-link" href="#master-panel-main">
          Skip to Master Panel content
        </a>

        <header className={styles.masthead} data-av-surface="ink">
          <Link className="brand" href="/game" aria-label="Return to AUREVANE">
            <span className="brand__crest" aria-hidden="true">
              <span>A</span>
            </span>
            <span className="brand__wordmark">
              <strong>AUREVANE</strong>
              <small>Persistent tactical fantasy</small>
            </span>
          </Link>

          <nav className={styles.referenceNav} aria-label="Reference">
            <Link href="/news">News</Link>
            <Link href="/manual">Manual</Link>
            <Link href="/rules">Rules</Link>
          </nav>

          <div className={styles.headerUtility}>
            <Link className={styles.returnLink} href="/game">
              Return to game
            </Link>
            <AccountMenu masterPanelHref="/master" />
          </div>
        </header>

        <aside className={styles.rail} data-av-surface="ink">
          <div className={styles.railTitle}>
            <span aria-hidden="true">✦</span>
            <div>
              <strong>Master Panel</strong>
              <small>{owner ? 'Worldwright control' : 'Staff operations'}</small>
            </div>
          </div>

          <nav className={styles.railNavigation} aria-label="Master Panel navigation">
            {masterNavigation.map((item) => {
              if (item.capability && !hasMasterPanelCapability(access, item.capability)) return null
              const active = item.id === activeSection
              return (
                <Link
                  key={item.id}
                  className={styles.railLink}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={styles.railIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className={styles.railCopy}>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </Link>
              )
            })}
          </nav>

          <div className={styles.railFooter}>
            <span aria-hidden="true">✧</span>
            <strong>Living worlds</strong>
            <small>Stronger together</small>
          </div>
        </aside>

        <main className={styles.main} id="master-panel-main" tabIndex={-1}>
          <section className={styles.hero} aria-labelledby="master-panel-page-title">
            <AurevaneImage assetId="ui.foundation.vista" className={styles.heroMedia} />
            <div className={styles.heroShade} aria-hidden="true" />
            <div className={styles.heroCopy}>
              <h1 id="master-panel-page-title">{title}</h1>
              <p className={styles.description}>{description}</p>
            </div>
          </section>

          <div className={styles.content}>{children}</div>
        </main>

        <footer className={styles.footer} data-av-surface="ink">
          <OnlinePresenceLink />
        </footer>
      </div>
    </div>
  )
}
