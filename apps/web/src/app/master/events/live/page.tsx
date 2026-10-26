import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { EventWorkspaceClient } from '@/components/master/events/event-workspace-client'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { hasMasterPanelCapability } from '@/server/master/staff-access'

export const dynamic = 'force-dynamic'

export default async function MasterEventOperationsPage() {
  const { access } = await requireMasterPanelPageAccess('events.operate')

  return (
    <MasterPanelShell
      access={access}
      activeSection="events"
      title="Events & Live Ops"
      description="Monitor and operate authoritative Event Runs, phases, cleanup, recovery, rewards, and Chronicle closure."
    >
      <EventWorkspaceClient
        canPublish={hasMasterPanelCapability(access, 'events.production_publish')}
        canUseGlobalScope={hasMasterPanelCapability(access, 'events.global_scope')}
        canEmergencyStop={hasMasterPanelCapability(access, 'events.emergency_stop')}
        initialView="live"
      />
    </MasterPanelShell>
  )
}
