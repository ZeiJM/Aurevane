import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { EventOperationsClient } from '@/components/master/events/event-operations-client'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { hasMasterPanelCapability } from '@/server/master/staff-access'

export const dynamic = 'force-dynamic'

export default async function MasterEventOperationsPage() {
  const { access } = await requireMasterPanelPageAccess('events.operate')

  return (
    <MasterPanelShell
      access={access}
      activeSection="live-events"
      title="Live Event Operations"
      description="Monitor and operate authoritative Event Runs, phases, cleanup, recovery, rewards, and Chronicle closure."
    >
      <EventOperationsClient
        canEmergencyStop={hasMasterPanelCapability(access, 'events.emergency_stop')}
      />
    </MasterPanelShell>
  )
}
