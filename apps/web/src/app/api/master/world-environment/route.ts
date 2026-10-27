import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'
import {
  readWorldEnvironmentAdminSettings,
  setWorldEnvironment,
} from '@/server/master/world-environment-admin-store'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

async function requireWorldPageAccess() {
  const actor = await getAuthenticatedActor()
  await createServerMasterPanelStaffAccessService().requireCapability(actor.userId, 'world.manage')
  return actor
}

export async function GET() {
  try {
    await requireWorldPageAccess()
    return Response.json(
      { settings: await readWorldEnvironmentAdminSettings() },
      { headers: NO_STORE },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireWorldPageAccess()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new AurevaneError('INVALID_REQUEST', 'Request body must be valid JSON.')
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new AurevaneError('INVALID_REQUEST', 'Expected version and change are required.')
    const input = body as { expectedVersion?: unknown; change?: unknown }
    const settings = await setWorldEnvironment({
      actorUserId: actor.userId,
      expectedVersion: input.expectedVersion,
      change: input.change,
    })
    return Response.json({ settings }, { headers: NO_STORE })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
