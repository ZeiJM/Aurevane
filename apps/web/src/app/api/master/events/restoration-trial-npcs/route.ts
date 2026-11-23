import { AurevaneError } from '@aurevane/game-core/errors'
import { isPersonalJourneyNpcId } from '@aurevane/game-core/events/persistent-event'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import {
  readPublishedRestorationTrialNpc,
  readPublishedWorldNpcs,
} from '@/server/master/npc-design-store'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'
import { resolveSector, WORLD_SECTORS } from '@/server/world/world-content'
import { isWalkable } from '@/world/travel'

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    await createServerMasterPanelStaffAccessService().requireCapability(
      actor.userId,
      'events.author',
    )
    const { searchParams } = new URL(request.url)
    const npcId = searchParams.get('npcId')
    const sectorId = searchParams.get('sectorId')
    const view = searchParams.get('view')
    const headers = { 'Cache-Control': 'private, no-store' }
    if (view !== null && (view !== 'tags' || sectorId === null || npcId !== null)) {
      throw new AurevaneError('INVALID_REQUEST', 'Choose one charted sector to browse tags.')
    }
    if (npcId !== null) {
      if (sectorId !== null || !isPersonalJourneyNpcId(npcId)) {
        throw new AurevaneError('INVALID_REQUEST', 'Choose a single World encounter NPC.')
      }
      const npc = await readPublishedRestorationTrialNpc(actor.userId, npcId)
      const sector = npc && resolveSector(npc.sectorId)
      const choice =
        npc && sector?.charted && isWalkable(sector, npc)
          ? { id: npc.id, name: npc.name, sectorId: npc.sectorId }
          : null
      return Response.json({ npc: choice }, { headers })
    }
    if (sectorId === null) {
      const sectors = WORLD_SECTORS.filter((sector) => sector.charted)
        .map(({ id, name, coordinate }) => ({ id, name: `${name} · ${coordinate}` }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return Response.json({ sectors }, { headers })
    }
    const sector = resolveSector(sectorId)
    if (!sector?.charted)
      throw new AurevaneError('INVALID_REQUEST', 'Choose a charted World sector.')
    const encounters = (await readPublishedWorldNpcs(sector.id)).filter(
      (npc) => npc.encounter && isWalkable(sector, npc),
    )
    if (view === 'tags') {
      const tags = [...new Set(encounters.flatMap((npc) => npc.encounter?.tags ?? []))].sort()
      return Response.json({ tags }, { headers })
    }
    const npcs = encounters
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    return Response.json({ npcs }, { headers })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
