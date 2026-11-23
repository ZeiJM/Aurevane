import { AurevaneError } from '@aurevane/game-core/errors'
import { parseNpcArenaRehearsalRequest } from '@aurevane/validation/combat/npc-design'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { rehearseNpcArenaTurn } from '@/server/master/npc-arena-rehearsal'
import { readNpcDesigns } from '@/server/master/npc-design-store'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    await createServerMasterPanelStaffAccessService().requireCapability(actor.userId, 'npc.manage')
    const command = parseNpcArenaRehearsalRequest(await request.json().catch(() => null))
    if (!command) throw new AurevaneError('INVALID_REQUEST', 'Invalid Arena rehearsal request.')
    const record = (await readNpcDesigns(actor.userId)).find((entry) => entry.id === command.id)
    if (!record || record.revision !== command.revision) {
      throw new AurevaneError('STALE_VERSION', 'Refresh the saved NPC draft before testing again.')
    }
    const rehearsal = await rehearseNpcArenaTurn(record)
    return Response.json({ rehearsal }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
