import { EventOperationsClient } from '@/components/master/events/event-operations-client'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { hasMasterPanelCapability, masterPanelAuthorityLabel } from '@/server/master/staff-access'

import styles from '../../master.module.css'

export const dynamic = 'force-dynamic'

export default async function MasterEventOperationsPage() {
  const { access } = await requireMasterPanelPageAccess('events.operate')

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.masthead}>
          <div className={styles.brand}>
            <strong>AUREVANE</strong>
            <span>Master Panel · Live Event Operations</span>
          </div>
          <span className={styles.operator}>{masterPanelAuthorityLabel(access.roles)}</span>
        </header>

        <EventOperationsClient
          canEmergencyStop={hasMasterPanelCapability(access, 'events.emergency_stop')}
        />
      </div>
    </main>
  )
}
