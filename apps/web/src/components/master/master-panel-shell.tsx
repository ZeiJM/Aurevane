import type { ReactNode } from 'react'

import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { hasMasterPanelCapability } from '@/lib/master-panel-access'
import {
  MASTER_PANEL_NAVIGATION,
  normalizeMasterPanelOrder,
  type MasterPanelTab,
} from '@/lib/master-panel-pages'
import { MasterPanelNavigation } from './master-panel-navigation'
import type { MasterPanelAccess } from '@/server/master/staff-access'

import styles from './master-panel-shell.module.css'

export type MasterPanelSection = MasterPanelTab | 'overview'

interface MasterPanelShellProps {
  access: MasterPanelAccess
  activeSection: MasterPanelSection
  title: string
  description: string
  children: ReactNode
}

export function masterNavigationForAccess(access: MasterPanelAccess) {
  return normalizeMasterPanelOrder(access.navigation?.order).flatMap((id) =>
    MASTER_PANEL_NAVIGATION.filter(
      (item) => item.id === id && hasMasterPanelCapability(access, item.capabilities[0]),
    ),
  )
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
        <MasterPanelNavigation
          items={masterNavigationForAccess(access)}
          activeSection={activeSection}
          settings={access.navigation}
          canArrange={
            access.roles.includes('game-owner') && hasMasterPanelCapability(access, 'staff.manage')
          }
        />
        <div className={styles.content}>{children}</div>
      </section>
    </AuthenticatedShellFrame>
  )
}
