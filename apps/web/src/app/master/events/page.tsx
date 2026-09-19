import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { EventBuilderClient } from '@/components/master/events/event-builder-client'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { hasMasterPanelCapability } from '@/server/master/staff-access'

export const dynamic = 'force-dynamic'

export default async function MasterEventsPage() {
  const { access } = await requireMasterPanelPageAccess('events.author')

  return (
    <MasterPanelShell
      access={access}
      activeSection="events"
      title="Event Builder"
      description="Draft, validate, preview, publish, and schedule persistent Events through typed authoritative content."
    >
      <EventBuilderClient
        canPublish={hasMasterPanelCapability(access, 'events.production_publish')}
        canUseGlobalScope={hasMasterPanelCapability(access, 'events.global_scope')}
      />
    </MasterPanelShell>
  )
}
