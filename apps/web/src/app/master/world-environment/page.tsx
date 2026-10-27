import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { WorldEnvironmentEditor } from '@/components/master/world-environment/world-environment-editor'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { readWorldEnvironmentAdminSettings } from '@/server/master/world-environment-admin-store'

export const dynamic = 'force-dynamic'

export default async function MasterWorldEnvironmentPage() {
  const { access } = await requireMasterPanelPageAccess('world.manage')
  const settings = await readWorldEnvironmentAdminSettings()
  return (
    <MasterPanelShell
      access={access}
      activeSection="world-environment"
      title="World Environment"
      description="Owner-controlled server time and weather for the World page"
    >
      <WorldEnvironmentEditor initialSettings={settings} />
    </MasterPanelShell>
  )
}
