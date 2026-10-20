import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerMasterPlayersService } from './players-server'
import { playerRecord, type MasterPlayersService } from './players-service'

interface Dependencies {
  getActor(): Promise<{ userId: string }>
  createService(): MasterPlayersService
}
const defaults: Dependencies = {
  getActor: getAuthenticatedActor,
  createService: createServerMasterPlayersService,
}
function invalid(): never {
  throw new AurevaneError(
    'INVALID_REQUEST',
    'Review the selected character and confirm the complete change.',
  )
}
function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/iu.test(value)
  )
    invalid()
  return value
}
export async function handleMasterPlayersRequest(
  request: Request,
  dependencies: Dependencies = defaults,
): Promise<Response> {
  try {
    const actor = await dependencies.getActor()
    let input: unknown
    try {
      input = await request.json()
    } catch {
      invalid()
    }
    if (!playerRecord(input)) invalid()
    const operation = input.operation
    const allowed =
      operation === 'search'
        ? ['operation', 'query']
        : operation === 'read'
          ? ['operation', 'characterId']
          : operation === 'edit'
            ? ['operation', 'characterId', 'fingerprint', 'requestKey', 'command', 'confirmed']
            : operation === 'recover'
              ? [
                  'operation',
                  'characterId',
                  'battleSessionId',
                  'expectedVersion',
                  'participantIds',
                  'requestKey',
                  'confirmed',
                ]
              : []
    if (Object.keys(input).some((key) => !allowed.includes(key)) || !allowed.length) invalid()
    const service = dependencies.createService()
    let result: unknown
    if (operation === 'search') {
      if (typeof input.query !== 'string') invalid()
      result = { players: await service.search(actor.userId, input.query) }
    } else if (operation === 'read')
      result = { player: await service.read(actor.userId, uuid(input.characterId)) }
    else {
      if (input.confirmed !== true) invalid()
      const characterId = uuid(input.characterId),
        requestKey = uuid(input.requestKey)
      if (operation === 'edit') {
        if (typeof input.fingerprint !== 'string' || !/^[a-f0-9]{64}$/u.test(input.fingerprint))
          invalid()
        result = {
          player: await service.edit(
            actor.userId,
            characterId,
            input.fingerprint,
            requestKey,
            input.command,
          ),
        }
      } else {
        if (
          typeof input.expectedVersion !== 'number' ||
          !Number.isSafeInteger(input.expectedVersion) ||
          input.expectedVersion < 1 ||
          !Array.isArray(input.participantIds) ||
          input.participantIds.length < 1 ||
          input.participantIds.length > 6 ||
          new Set(input.participantIds).size !== input.participantIds.length
        )
          invalid()
        result = await service.recover(actor.userId, {
          characterId,
          requestKey,
          battleSessionId: uuid(input.battleSessionId),
          expectedVersion: input.expectedVersion,
          participantIds: input.participantIds.map(uuid),
        })
      }
    }
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
