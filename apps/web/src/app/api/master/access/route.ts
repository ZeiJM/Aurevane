import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'

export async function GET() {
  try {
    const actor = await getAuthenticatedActor()
    const access = await createServerMasterPanelStaffAccessService().readAccess(actor.userId)
    return Response.json(
      { hasAccess: access !== null },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
