import 'server-only'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerUsageBalanceService } from './usage-balance-server'
import type { UsageBalanceService } from './usage-balance'
export async function handleUsageBalanceRequest(
  request: Request,
  dependencies: {
    getActor: () => Promise<{ userId: string }>
    createService: () => UsageBalanceService
  } = { getActor: getAuthenticatedActor, createService: createServerUsageBalanceService },
) {
  try {
    const actor = await dependencies.getActor()
    const report = await dependencies
      .createService()
      .read(
        actor.userId,
        new URL(request.url).searchParams.get('contentKey') ?? '',
        new URL(request.url).searchParams.get('week') ?? undefined,
      )
    return Response.json(report, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
