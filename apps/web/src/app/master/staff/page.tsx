import Link from 'next/link'

import { StaffManagement } from '@/components/master/staff-management'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import {
  DELEGATED_MASTER_PANEL_ROLE_DETAILS,
  MASTER_PANEL_SPECIAL_CAPABILITY_DETAILS,
  masterPanelAuthorityLabel,
} from '@/server/master/staff-access'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'

import styles from '../master.module.css'

export const dynamic = 'force-dynamic'

export default async function MasterStaffPage() {
  const { actor, access } = await requireMasterPanelPageAccess('staff.manage')
  const staff = await createServerMasterPanelStaffAccessService().listStaff(actor.userId)
  const owner = access.roles.includes('game-owner')

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.masthead}>
          <div className={styles.brand}>
            <strong>AUREVANE</strong>
            <span>Master Panel · Staff &amp; Authority</span>
          </div>
          <span
            className={[styles.operator, owner ? styles.worldwright : ''].filter(Boolean).join(' ')}
          >
            {owner ? (
              <span className={styles.operatorIcon} aria-hidden="true">
                ✦
              </span>
            ) : null}
            {masterPanelAuthorityLabel(access.roles)}
          </span>
        </header>
        <Link className={styles.breadcrumb} href="/master">
          ← Master Panel
        </Link>
        <section className={styles.overview}>
          <h1>Staff authority</h1>
          <p>
            Manage the four fixed authority classes and explicit account capabilities. Every change
            is validated and audited on the server.
          </p>
        </section>
        <div className={styles.moduleSpacing}>
          <StaffManagement
            capabilityOptions={MASTER_PANEL_SPECIAL_CAPABILITY_DETAILS}
            roleOptions={DELEGATED_MASTER_PANEL_ROLE_DETAILS}
            staff={staff}
          />
        </div>
      </div>
    </main>
  )
}
