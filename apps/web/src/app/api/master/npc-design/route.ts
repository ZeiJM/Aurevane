import { AurevaneError } from '@aurevane/game-core/errors'
import { parseNpcDesignCommand } from '@aurevane/validation/combat/npc-design'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { writeNpcDesign } from '@/server/master/npc-design-store'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const access = await createServerMasterPanelStaffAccessService().requireCapability(
      actor.userId,
      'npc.manage',
    )
    const command = parseNpcDesignCommand(await request.json().catch(() => null))
    if (!command) throw new AurevaneError('INVALID_REQUEST', 'Invalid NPC Design request.')
    if (command.kind === 'commit-uniform' && !access.roles.includes('game-owner'))
      throw new AurevaneError(
        'FORBIDDEN',
        'Only the Game Owner may approve an exact NPC appearance copy.',
      )
    const record = await writeNpcDesign(actor.userId, command)
    return Response.json({ record }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
