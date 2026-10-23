import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'
import { publishBattlefieldElevationPolicy } from '@/server/master/battlefield-elevation-policy-store'
export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    await createServerMasterPanelStaffAccessService().requireCapability(
      actor.userId,
      'staff.manage',
    )
    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new AurevaneError('INVALID_REQUEST', 'Request body must be valid JSON.')
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new AurevaneError('INVALID_REQUEST', 'Elevation settings are required.')
    const input = body as { policy?: unknown }
    const policy = await publishBattlefieldElevationPolicy({
      actorUserId: actor.userId,
      policy: input.policy,
    })
    return Response.json({ policy }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
