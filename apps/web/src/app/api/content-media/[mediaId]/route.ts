import { createContentMediaStore } from '@/server/master/combat-content-media-store'
import { serveContentMedia } from '@/server/master/combat-content-media-handler'
export const runtime = 'nodejs'
export async function GET(request: Request, context: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await context.params
  return serveContentMedia(request, mediaId, (id) => createContentMediaStore().readPublished(id))
}
