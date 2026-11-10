import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { NpcDesignEditor } from '@/components/master/npc-design-editor'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { WORLD_SECTORS } from '@/server/world/world-content'
import { readNpcDesigns } from '@/server/master/npc-design-store'

export const dynamic = 'force-dynamic'

export default async function NpcDesignPage({
  searchParams,
}: {
  searchParams: Promise<{ npc?: string }>
}) {
  const { actor, access } = await requireMasterPanelPageAccess('npc-design')
  const [records, params] = await Promise.all([readNpcDesigns(actor.userId), searchParams])
  const sectors = WORLD_SECTORS.filter((sector) => sector.charted)
    .map(({ id, name, coordinate }) => ({ id, name: `${name} · ${coordinate}` }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return (
    <MasterPanelShell
      access={access}
      activeSection="npc-design"
      title="NPC Design"
      description="Create reusable characters and assign published fighters to the Battle Hall."
    >
      <NpcDesignEditor
        initialRecords={records}
        initialNpcId={params.npc}
        sectors={sectors}
        canApproveUniforms={access.roles.includes('game-owner')}
      />
    </MasterPanelShell>
  )
}
