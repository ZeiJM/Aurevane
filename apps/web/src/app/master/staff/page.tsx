import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { StaffManagement } from '@/components/master/staff-management'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import {
  DELEGATED_MASTER_PANEL_ROLE_DETAILS,
  MASTER_PANEL_SPECIAL_CAPABILITY_DETAILS,
} from '@/server/master/staff-access'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'

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
      <StaffManagement
        capabilityOptions={MASTER_PANEL_SPECIAL_CAPABILITY_DETAILS}
        roleOptions={DELEGATED_MASTER_PANEL_ROLE_DETAILS}
        staff={staff}
      />
    </MasterPanelShell>
  )
}
