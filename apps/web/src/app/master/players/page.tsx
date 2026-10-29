import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { PlayersWorkspace } from '@/components/master/players-workspace'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { createServerMasterPlayersService } from '@/server/master/players-server'
export const dynamic = 'force-dynamic'
export default async function MasterPlayersPage({
  searchParams,
}: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const { actor, access } = await requireMasterPanelPageAccess('players.manage')
  const query = (await searchParams) ?? {}
  const characterId =
    typeof query.characterId === 'string' &&
    /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(query.characterId)
      ? query.characterId
      : null
  const player = characterId
    ? await createServerMasterPlayersService().read(actor.userId, characterId)
    : null
  return (
    <MasterPanelShell
      access={access}
      activeSection="players"
      title="Players"
      description="Inspect existing gameplay facts, review corrections, and recover stuck encounters."
    >
      <PlayersWorkspace initialPlayer={player} />
    </MasterPanelShell>
  )
}
