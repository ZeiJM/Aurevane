import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'
import { publishCombatEffectTimingPolicy } from '@/server/master/combat-effect-timing-policy-store'
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
      throw new AurevaneError('INVALID_REQUEST', 'Timing policy and reason are required.')
    const input = body as { policy?: unknown; reason?: unknown }
    const policy = await publishCombatEffectTimingPolicy({
      actorUserId: actor.userId,
      policy: input.policy,
      reason: input.reason,
    })
    return Response.json({ policy }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
