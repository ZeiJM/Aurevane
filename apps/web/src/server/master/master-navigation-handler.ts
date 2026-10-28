import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerMasterNavigationService } from './master-navigation-server'
import type { MasterNavigationService } from './master-navigation-service'

export async function handleMasterNavigationRequest(
  request: Request,
  dependencies = {
    getActor: getAuthenticatedActor as () => Promise<{ userId: string }>,
    createService: createServerMasterNavigationService as () => MasterNavigationService,
  },
) {
  try {
    const actor = await dependencies.getActor()
    const body: unknown = await request.json().catch(() => null)
    if (
      request.method !== 'POST' ||
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !['expectedRevision', 'order'].includes(key))
    )
      throw new AurevaneError('INVALID_REQUEST', 'Choose a valid tab order.')
    const input = body as { expectedRevision: unknown; order: unknown }
    const settings = await dependencies.createService().save(actor.userId, input)
    return Response.json({ settings }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
