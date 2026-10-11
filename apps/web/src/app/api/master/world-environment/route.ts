import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'
import {
  readWorldEnvironmentHistory,
  setWorldEnvironment,
} from '@/server/master/world-environment-admin-store'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

async function requireOwner() {
  const actor = await getAuthenticatedActor()
  const access = await createServerMasterPanelStaffAccessService().requireCapability(
    actor.userId,
    'staff.manage',
  )
  // The database RPC independently asserts Game Owner authority.
  if (!access.roles.includes('game-owner'))
    throw new AurevaneError('FORBIDDEN', 'Only the Game Owner may change the world environment.')
  return actor
}

export async function GET() {
  try {
    await requireOwner()
    return Response.json({ history: await readWorldEnvironmentHistory(20) }, { headers: NO_STORE })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOwner()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new AurevaneError('INVALID_REQUEST', 'Request body must be valid JSON.')
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Expected version, change and reason are required.',
      )
    const input = body as { expectedVersion?: unknown; change?: unknown; reason?: unknown }
    const settings = await setWorldEnvironment({
      actorUserId: actor.userId,
      expectedVersion: input.expectedVersion,
      change: input.change,
      reason: input.reason,
    })
    const history = await readWorldEnvironmentHistory(20)
    return Response.json({ settings, history }, { headers: NO_STORE })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
