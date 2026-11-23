import { AurevaneError } from '@aurevane/game-core/errors'

import { parseNpcVariantRequest } from '@/lib/npc-appearance-variants'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { previewNpcAppearanceVariants } from '@/server/master/npc-appearance-variants'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const access = await createServerMasterPanelStaffAccessService().requireCapability(
      actor.userId,
      'npc.manage',
    )
    const input = parseNpcVariantRequest(await request.json().catch(() => null))
    if (!input)
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Choose a compatible starting look, variation fields, and two to eight candidates.',
      )
    if (input.mode === 'uniform' && !access.roles.includes('game-owner'))
      throw new AurevaneError(
        'FORBIDDEN',
        'Only the Game Owner may create intentional exact copies.',
      )
    const candidates = await previewNpcAppearanceVariants(actor.userId, input)
    return Response.json({ candidates }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
