import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { ModerationWorkspace } from '@/components/master/moderation-workspace'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { createServerMasterModerationService } from '@/server/master/moderation-server'
export const dynamic = 'force-dynamic'
export default async function MasterModerationPage() {
  const { access } = await requireMasterPanelPageAccess('moderation.manage')
  const active = await createServerMasterModerationService().listActive(access.userId)
  return (
    <MasterPanelShell
      access={access}
      activeSection="moderation"
      title="Moderation"
      description="Account bans and moderation history"
    >
      <ModerationWorkspace initialBans={active} />
    </MasterPanelShell>
  )
}
