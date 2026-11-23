import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerMasterModerationService } from './moderation-server'
import type { MasterModerationService, ModerationChange } from './moderation-service'
const defaults = {
  getActor: getAuthenticatedActor,
  createService: createServerMasterModerationService,
}
export async function handleMasterModerationRequest(
  request: Request,
  dependencies: {
    getActor(): Promise<{ userId: string }>
    createService(): MasterModerationService
  } = defaults,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    const service = dependencies.createService()
    let input: unknown
    try {
      input = await request.json()
    } catch {
      throw new AurevaneError('INVALID_REQUEST', 'Enter a valid moderation request.')
    }
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new AurevaneError('INVALID_REQUEST', 'Enter a valid moderation request.')
    const body = input as Record<string, unknown>
    if (
      Object.keys(body).some(
        (key) =>
          ![
            'operation',
            'query',
            'targetUserId',
            'expectedRevision',
            'action',
            'reason',
            'minutes',
            'permanent',
            'confirmed',
            'before',
            'after',
          ].includes(key),
      )
    )
      throw new AurevaneError('INVALID_REQUEST', 'Unexpected moderation fields.')
    const headers = { 'Cache-Control': 'private, no-store' }
    if (body.operation === 'active')
      return Response.json(
        { active: await service.listActive(actor.userId, (body.after ?? null) as string | null) },
        { headers },
      )
    if (body.operation === 'search' && typeof body.query === 'string')
      return Response.json({ players: await service.search(actor.userId, body.query) }, { headers })
    if (
      typeof body.targetUserId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.targetUserId,
      )
    )
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Choose a player from the verified search results.',
      )
    if (body.operation === 'read')
      return Response.json(
        {
          record: await service.read(
            actor.userId,
            body.targetUserId,
            (body.before ?? null) as string | null,
          ),
        },
        { headers },
      )
    if (
      body.operation === 'lift' &&
      Object.keys(body).every((key) =>
        ['operation', 'targetUserId', 'expectedRevision'].includes(key),
      )
    )
      return Response.json(
        {
          record: await service.write(actor.userId, {
            targetUserId: body.targetUserId,
            expectedRevision: body.expectedRevision as string,
            action: 'lift',
            reason: 'Ban lifted from the Moderation panel.',
            minutes: null,
            permanent: false,
          }),
        },
        { headers },
      )
    if (body.operation === 'write' && body.confirmed === true)
      return Response.json(
        { record: await service.write(actor.userId, body as unknown as ModerationChange) },
        { headers },
      )
    throw new AurevaneError('INVALID_REQUEST', 'Confirm the moderation change.')
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
