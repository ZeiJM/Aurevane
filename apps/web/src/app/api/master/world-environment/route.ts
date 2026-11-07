import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { projectWorld } from '@/server/world/world-service'
import { WORLD_REGIONS } from '@/world/catalog'
import { newWorldState } from '@/world/travel'
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

export async function GET(request: Request) {
  try {
    await requireWorldPageAccess()
    const regionId = new URL(request.url).searchParams.get('previewRegion')
    if (regionId !== null) {
      if (!WORLD_REGIONS.some((region) => region.id === regionId))
        throw new AurevaneError('INVALID_REQUEST', 'Choose a public region.')
      const state = newWorldState()
      state.position = { sectorId: regionId, x: 6, y: 4 }
      const view = projectWorld(state, [], Date.now(), [])
      return Response.json(
        {
          view: {
            ...view,
            sectors: view.sectors.filter((sector) => sector.charted),
            atlas: view.atlas?.filter((cell) => cell.charted),
            interactions: [],
          },
        },
        { headers: NO_STORE },
      )
    }
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
