import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { readPublishedStoryNpcs } from '@/server/master/npc-design-store'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'

export async function GET() {
  try {
    const actor = await getAuthenticatedActor()
    await createServerMasterPanelStaffAccessService().requireCapability(
      actor.userId,
      'events.author',
    )
    const npcs = await readPublishedStoryNpcs(actor.userId)
    return Response.json({ npcs }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
