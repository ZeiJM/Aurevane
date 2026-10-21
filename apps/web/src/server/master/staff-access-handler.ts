import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import {
  isDelegatedMasterPanelRole,
  isMasterPanelSpecialCapability,
  type MasterPanelStaffAccessService,
  type DelegatedMasterPanelRole,
  type MasterPanelSpecialCapability,
} from './staff-access'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'

export interface StaffAccessHandlerDependencies {
  getActor(): Promise<{ userId: string }>
  createService(): MasterPanelStaffAccessService
}
const defaultDependencies: StaffAccessHandlerDependencies = {
  getActor: getAuthenticatedActor,
  createService: createServerMasterPanelStaffAccessService,
}
function invalid(): never {
  throw new AurevaneError(
    'INVALID_REQUEST',
    'Choose a verified identity, linked character and permitted access. Confirm the change.',
  )
}
function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    invalid()
  return value as string
}
export async function handleStaffAccessRequest(
  request: Request,
  dependencies: StaffAccessHandlerDependencies = defaultDependencies,
): Promise<Response> {
  try {
    if (request.method !== 'POST') invalid()
    const actor = await dependencies.getActor(),
      service = dependencies.createService()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      invalid()
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) invalid()
    const input = body as Record<string, unknown>
    const headers = { 'Cache-Control': 'private, no-store' }
    if (input.operation === 'resolve-account') {
      if (typeof input.query !== 'string') invalid()
      return Response.json(
        { account: await service.resolveIdentity(actor.userId, input.query as string) },
        { headers },
      )
    }
    if (
      input.operation !== 'set-character-access' ||
      input.confirmed !== true ||
      !Array.isArray(input.roles) ||
      !input.roles.every(isDelegatedMasterPanelRole) ||
      !Array.isArray(input.specialCapabilities) ||
      !input.specialCapabilities.every(isMasterPanelSpecialCapability) ||
      (input.days !== null && !Number.isSafeInteger(input.days)) ||
      !Number.isSafeInteger(input.expectedVersion) ||
      typeof input.enabled !== 'boolean'
    )
      invalid()
    const accessVersion = await service.setCharacterAccess({
      actorUserId: actor.userId,
      targetUserId: uuid(input.targetUserId),
      targetCharacterId: uuid(input.targetCharacterId),
      roles: input.roles as DelegatedMasterPanelRole[],
      specialCapabilities: input.specialCapabilities as MasterPanelSpecialCapability[],
      days: input.days as number | null,
      expectedVersion: input.expectedVersion as number,
      enabled: input.enabled as boolean,
    })
    return Response.json({ accessVersion }, { headers })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
