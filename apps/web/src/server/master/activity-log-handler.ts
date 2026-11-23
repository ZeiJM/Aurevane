import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { isActivityCursor, type MasterActivityService } from './activity-log'
import { createServerMasterActivityService } from './activity-log-server'

interface Dependencies {
  getActor(): Promise<{ userId: string }>
  createService(): MasterActivityService
}
const defaults: Dependencies = {
  getActor: getAuthenticatedActor,
  createService: createServerMasterActivityService,
}
export async function handleMasterActivityRequest(
  request: Request,
  dependencies: Dependencies = defaults,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const params = new URL(request.url).searchParams
    const before = params.get('before')
    if (
      Array.from(params.keys()).some((key) => key !== 'before') ||
      params.getAll('before').length > 1 ||
      (before !== null && !isActivityCursor(before))
    )
      throw new AurevaneError('INVALID_REQUEST', 'Choose a valid activity page.')
    const feed = await dependencies.createService().read(actor.userId, before)
    return Response.json(feed, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
