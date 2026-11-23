import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { MasterActivityLog } from '@/components/master/activity-log'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { createServerMasterActivityService } from '@/server/master/activity-log-server'

export const dynamic = 'force-dynamic'

export default async function MasterActivityPage() {
  const { actor, access } = await requireMasterPanelPageAccess('activity.read')
  const feed = await createServerMasterActivityService().read(actor.userId)
  return (
    <MasterPanelShell
      access={access}
      activeSection="activity"
      title="Activity Log"
      description="Changes made in the Master Panel this week."
    >
      <MasterActivityLog initialFeed={feed} />
    </MasterPanelShell>
  )
}
