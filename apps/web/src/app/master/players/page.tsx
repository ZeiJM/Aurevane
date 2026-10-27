import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { PlayersWorkspace } from '@/components/master/players-workspace'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
export const dynamic = 'force-dynamic'
export default async function MasterPlayersPage() {
  const { access } = await requireMasterPanelPageAccess('players.manage')
  return (
    <MasterPanelShell
      access={access}
      activeSection="players"
      title="Players"
      description="Inspect existing gameplay facts, review corrections, and recover stuck encounters."
    >
      <PlayersWorkspace />
    </MasterPanelShell>
  )
}
