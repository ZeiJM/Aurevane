import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { StaffManagement } from '@/components/master/staff-management'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { DELEGATED_MASTER_PANEL_ROLE_DETAILS } from '@/server/master/staff-access'
import {
  createServerMasterPanelStaffAccessService,
  createServerMasterPanelRoleDefaultsService,
} from '@/server/master/staff-access-server'

export const dynamic = 'force-dynamic'

export default async function MasterStaffPage() {
  const { actor, access } = await requireMasterPanelPageAccess('staff.manage')
  const [staff, roleDefaults] = await Promise.all([
    createServerMasterPanelStaffAccessService().listStaff(actor.userId),
    createServerMasterPanelRoleDefaultsService().readRoleDefaults(actor.userId),
  ])

  return (
    <MasterPanelShell
      access={access}
      activeSection="staff"
      title="Staff & Access"
      description="Assign clear responsibilities to one verified linked character."
    >
      <StaffManagement
        roleOptions={DELEGATED_MASTER_PANEL_ROLE_DETAILS}
        staff={staff}
        roleDefaults={roleDefaults}
      />
    </MasterPanelShell>
  )
}
