import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { ModerationWorkspace } from '@/components/master/moderation-workspace'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
export const dynamic = 'force-dynamic'
export default async function MasterModerationPage() {
  const { access } = await requireMasterPanelPageAccess('moderation.manage')
  return (
    <MasterPanelShell
      access={access}
      activeSection="moderation"
      title="Moderation"
      description="Account bans and moderation history"
    >
      <ModerationWorkspace />
    </MasterPanelShell>
  )
}
