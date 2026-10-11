import { redirect } from 'next/navigation'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { WorldEnvironmentEditor } from '@/components/master/world-environment/world-environment-editor'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import {
  readWorldEnvironmentAdminSettings,
  readWorldEnvironmentHistory,
} from '@/server/master/world-environment-admin-store'

export const dynamic = 'force-dynamic'

export default async function MasterWorldEnvironmentPage() {
  const { access } = await requireMasterPanelPageAccess('staff.manage')
  if (!access.roles.includes('game-owner')) redirect('/master')
  const [settings, history] = await Promise.all([
    readWorldEnvironmentAdminSettings(),
    readWorldEnvironmentHistory(20),
  ])
  return (
    <MasterPanelShell
      access={access}
      activeSection="world-environment"
      title="World Environment"
      description="Owner-controlled server time and weather for the World page"
    >
      <WorldEnvironmentEditor initialSettings={settings} initialHistory={history} />
    </MasterPanelShell>
  )
}
