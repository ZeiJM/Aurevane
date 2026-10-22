import { getAuthenticatedActor } from '@/server/auth/actor'
import { createContentMediaStore } from '@/server/master/combat-content-media-store'
import { serveContentMedia } from '@/server/master/combat-content-media-handler'
export const runtime = 'nodejs'
export async function GET(request: Request, context: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await context.params
  return serveContentMedia(
    request,
    mediaId,
    async (id) => {
      const actor = await getAuthenticatedActor()
      return createContentMediaStore(actor.userId).read(id)
    },
    true,
  )
}
