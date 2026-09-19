import { EventBuilderClient } from '@/components/master/events/event-builder-client'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { hasMasterPanelCapability, masterPanelAuthorityLabel } from '@/server/master/staff-access'

import styles from '../master.module.css'

export const dynamic = 'force-dynamic'

export default async function MasterEventsPage() {
  const { access } = await requireMasterPanelPageAccess('events.author')

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.masthead}>
          <div className={styles.brand}>
            <strong>AUREVANE</strong>
            <span>Master Panel · Event Builder</span>
          </div>
          <span className={styles.operator}>{masterPanelAuthorityLabel(access.roles)}</span>
        </header>

        <EventBuilderClient
          canPublish={hasMasterPanelCapability(access, 'events.production_publish')}
          canUseGlobalScope={hasMasterPanelCapability(access, 'events.global_scope')}
        />
      </div>
    </main>
  )
}
