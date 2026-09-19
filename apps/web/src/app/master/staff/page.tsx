import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { StaffManagement } from '@/components/master/staff-management'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import {
  DELEGATED_MASTER_PANEL_ROLE_DETAILS,
  MASTER_PANEL_SPECIAL_CAPABILITY_DETAILS,
} from '@/server/master/staff-access'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'

import styles from '../master.module.css'

export const dynamic = 'force-dynamic'

export default async function MasterStaffPage() {
  const { actor, access } = await requireMasterPanelPageAccess('staff.manage')
  const staff = await createServerMasterPanelStaffAccessService().listStaff(actor.userId)

  return (
    <MasterPanelShell
      access={access}
      activeSection="staff"
      title="Staff & Authority"
      description="Delegate responsibility without weakening AUREVANE’s single protected Game Owner boundary."
    >
      <section className={styles.sectionPanel}>
        <div>
          <span className={styles.cardKicker}>Authority controls</span>
          <h2>Roles, capabilities, and audited delegation.</h2>
        </div>
        <p>
          Every staff mutation requires server authority, a reason, and explicit confirmation.
          Protected Game Owner identity cannot be created or removed through delegated controls.
        </p>
      </section>

      <div className={styles.moduleSpacing}>
        <StaffManagement
          capabilityOptions={MASTER_PANEL_SPECIAL_CAPABILITY_DETAILS}
          roleOptions={DELEGATED_MASTER_PANEL_ROLE_DETAILS}
          staff={staff}
        />
      </div>
    </MasterPanelShell>
  )
}
