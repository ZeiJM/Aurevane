import Link from 'next/link'
import type { ReactNode } from 'react'

import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { hasMasterPanelCapability } from '@/lib/master-panel-access'
import type { MasterPanelAccess, MasterPanelCapability } from '@/server/master/staff-access'

import styles from './master-panel-shell.module.css'

export type MasterPanelSection =
  | 'overview'
  | 'combat'
  | 'combat-timing'
  | 'world-environment'
  | 'players'
  | 'staff'
  | 'events'
  | 'moderation'
  | 'music'
  | 'activity'

interface MasterPanelShellProps {
  access: MasterPanelAccess
  activeSection: MasterPanelSection
  title: string
  description: string
  children: ReactNode
}

export const masterNavigation = [
  {
    id: 'activity',
    href: '/master/activity',
    label: 'Activity Log',
    detail: 'Recent changes',
    icon: '≡',
    capability: 'activity.read',
  },
  {
    id: 'players',
    href: '/master/players',
    label: 'Players',
    detail: 'Inspect & recover',
    icon: '♙',
    capability: 'players.manage',
  },
  {
    id: 'combat-timing',
    href: '/master/combat-timing',
    label: 'Combat Rules',
    detail: 'Timing & elevation',
    icon: '◷',
    capability: 'combat.rules',
  },
  {
    id: 'world-environment',
    href: '/master/world-environment',
    label: 'World Environment',
    detail: 'Server time & weather',
    icon: '☼',
    capability: 'world.manage',
  },
  {
    id: 'combat',
    href: '/master/combat-content',
    label: 'Game Content',
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
    capability: 'music.manage',
  },
  {
    id: 'staff',
    href: '/master/staff',
    label: 'Staff & Access',
    detail: 'Roles & page access',
    icon: '♜',
    capability: 'staff.manage',
  },
  {
    id: 'events',
    href: '/master/events',
    label: 'Events',
    detail: 'Draft & schedule',
    icon: '✧',
    capability: 'events.author',
  },
  {
    id: 'moderation',
    href: '/master/moderation',
    label: 'Moderation',
    detail: 'Bans & history',
    icon: '⚑',
    capability: 'moderation.manage',
  },
] as const satisfies readonly {
  id: MasterPanelSection
  href:
    | '/master/combat-content'
    | '/master/combat-timing'
    | '/master/music'
    | '/master/world-environment'
    | '/master/players'
    | '/master/staff'
    | '/master/events'
    | '/master/moderation'
    | '/master/activity'
  label: string
  detail: string
  icon: string
  capability: MasterPanelCapability | null
}[]

export function masterNavigationForAccess(access: MasterPanelAccess) {
  const order: readonly MasterPanelSection[] = [
    'combat',
    'combat-timing',
    'events',
    'moderation',
    'players',
    'staff',
    'music',
    'world-environment',
    'activity',
  ]
  return masterNavigation
    .filter((item) => !item.capability || hasMasterPanelCapability(access, item.capability))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
}

export function MasterPanelShell({
  access,
  activeSection,
  title,
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
          <div>
            <span className="av-eyebrow">
              Master Panel ·{' '}
              {access.roles.includes('game-owner') ? 'Worldwright' : 'Staff workspace'}
            </span>
            <h1>{title}</h1>
          </div>
        </header>
        <nav className={styles.navigation} aria-label="Master Panel navigation">
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
