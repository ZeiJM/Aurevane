import { isFinalizedContentMedia } from '@aurevane/game-core/combat/content-media'
import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'
import { createContentMediaStore } from '@/server/master/combat-content-media-store'
import { handleContentMediaUpload } from '@/server/master/combat-content-media-handler'
import { toServerErrorResponse } from '@/server/http/error-response'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  let userId: string
  return handleContentMediaUpload(request, {
    authorize: async () => {
      const actor = await getAuthenticatedActor()
      userId = actor.userId
      await createServerMasterPanelStaffAccessService().requireCapability(
        userId,
        'content.combat.author',
      )
    },
    finalize: (media) => createContentMediaStore(userId).finalize(media),
  })
}
export async function GET() {
  try {
    const actor = await getAuthenticatedActor()
    const media = await createContentMediaStore(actor.userId).read(null)
    if (!Array.isArray(media) || !media.every(isFinalizedContentMedia))
      throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The finalized media list is unavailable.')
    return Response.json({ media }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
