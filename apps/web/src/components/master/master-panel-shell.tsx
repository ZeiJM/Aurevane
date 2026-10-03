import Link from 'next/link'
import type { ReactNode } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'

import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import {
  hasMasterPanelCapability,
  type MasterPanelAccess,
  type MasterPanelCapability,
} from '@/server/master/staff-access'

import styles from './master-panel-shell.module.css'

export type MasterPanelSection =
  'overview' | 'combat' | 'combat-timing' | 'staff' | 'events' | 'live-events' | 'music'

interface MasterPanelShellProps {
  access: MasterPanelAccess
  activeSection: MasterPanelSection
  title: string
  description: string
  children: ReactNode
}

export const masterNavigation = [
  {
    id: 'combat-timing',
    href: '/master/combat-timing',
    label: 'Effect Timing',
    detail: 'Activation & duration',
    icon: '◷',
    capability: 'staff.manage',
    ownerOnly: true,
  },
  {
    id: 'combat',
    href: '/master/combat-content',
    label: 'Combat Content',
    detail: 'Skills & publication',
    icon: '⚔',
    capability: 'content.combat.author',
  },
  {
    id: 'music',
    href: '/master/music',
    label: 'Site Music',
    detail: 'Global & page tracks',
    icon: '♫',
    capability: 'staff.manage',
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
    | '/master/combat-timing'
    | '/master/music'
    | '/master/staff'
    | '/master/events'
    | '/master/events/live'
  label: string
  detail: string
  icon: string
  capability: MasterPanelCapability | null
  ownerOnly?: boolean
}[]

export function masterNavigationForAccess(access: MasterPanelAccess) {
  return masterNavigation.filter(
    (item) =>
      (!('ownerOnly' in item) || !item.ownerOnly || access.roles.includes('game-owner')) &&
      (!item.capability || hasMasterPanelCapability(access, item.capability)),
  )
}

export function MasterPanelShell({
  access,
  activeSection,
  title,
  description,
  children,
}: MasterPanelShellProps) {
  return (
    <AuthenticatedShellFrame sessionLabel="Master Panel">
      <section
        className={`av-master ${styles.workspace}`}
        data-testid="master-panel-shell"
        data-master-composition={activeSection}
      >
        <header className={styles.heading}>
          <AurevaneImage
            assetId="environment.archive.interior"
            className={styles.headingArt}
            sizes="85vw"
          />
          <div>
            <span className="av-eyebrow">
              Master Panel ·{' '}
              {access.roles.includes('game-owner') ? 'Worldwright' : 'Staff workspace'}
            </span>
            <h1>{title}</h1>
          </div>
          <p>{description}</p>
        </header>
        <nav className={styles.navigation} aria-label="Master Panel navigation">
          <Link href="/master" aria-current={activeSection === 'overview' ? 'page' : undefined}>
            Overview
          </Link>
          {masterNavigationForAccess(access).map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={activeSection === item.id ? 'page' : undefined}
            >
              <span aria-hidden="true">{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.content}>{children}</div>
      </section>
    </AuthenticatedShellFrame>
  )
}
