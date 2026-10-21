import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'

import {
  isDelegatedMasterPanelRole,
  isMasterPanelSpecialCapability,
  type MasterPanelStaffAccessService,
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

type JsonObject = Record<string, unknown>

function invalid(message: string): never {
  throw new AurevaneError('INVALID_REQUEST', message)
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readBody(request: Request): Promise<JsonObject> {
  let value: unknown
  try {
    value = await request.json()
  } catch {
    return invalid('Request body must be valid JSON.')
  }
  if (!isObject(value)) return invalid('Request body must be a JSON object.')
  return value
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return invalid(field + ' must be a non-empty string.')
  }
  return value
}

function requiredUserId(value: unknown, field = 'targetCharacterId'): string {
  const userId = requiredString(value, field)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return invalid(field + ' must be a valid UUID.')
  }
  return userId
}

function requireConfirmation(value: unknown): void {
  if (value !== true) return invalid('confirmed must be true for staff authority changes.')
}

function success(body: unknown): Response {
  return Response.json(body, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function handleStaffAccessRequest(
  request: Request,
  dependencies: StaffAccessHandlerDependencies = defaultDependencies,
): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      throw new AurevaneError('INVALID_REQUEST', 'Master Panel staff changes require POST.')
    }

    const actor = await dependencies.getActor()
    const service = dependencies.createService()
    const body = await readBody(request)
    const operation = requiredString(body.operation, 'operation')

    if (operation === 'resolve-accounts') {
      const query = requiredString(body.query, 'query')
      return success({ accounts: await service.resolveAccounts(actor.userId, query) })
    }
    if (
      operation !== 'set-character-access' &&
      operation !== 'revoke-character-access' &&
      operation !== 'revoke-legacy-access'
    ) {
      return invalid('Unsupported Master Panel staff operation.')
    }
    requireConfirmation(body.confirmed)
    const expectedAccessVersion = body.expectedAccessVersion
    if (
      expectedAccessVersion !== null &&
      (!Number.isSafeInteger(expectedAccessVersion) || (expectedAccessVersion as number) < 1)
    ) {
      return invalid('expectedAccessVersion must be null or a positive integer.')
    }
    if (operation === 'revoke-legacy-access') {
      return success({
        accessVersion: await service.revokeLegacyAccess({
          actorUserId: actor.userId,
          targetUserId: requiredUserId(body.targetUserId, 'targetUserId'),
          expectedAccessVersion: expectedAccessVersion as number | null,
        }),
      })
    }
    const targetCharacterId = requiredUserId(body.targetCharacterId)
    const common = {
      actorUserId: actor.userId,
      targetCharacterId,
      expectedAccessVersion: expectedAccessVersion as number | null,
    }
    if (operation === 'revoke-character-access') {
      return success({ accessVersion: await service.revokeCharacterAccess(common) })
    }
    if (
      !Array.isArray(body.roles) ||
      body.roles.length === 0 ||
      !body.roles.every(isDelegatedMasterPanelRole)
    ) {
      return invalid('Choose approved delegated roles.')
    }
    if (
      !Array.isArray(body.specialCapabilities) ||
      !body.specialCapabilities.every(isMasterPanelSpecialCapability)
    ) {
      return invalid('Choose approved special permissions.')
    }
    if (
      body.days !== null &&
      (!Number.isSafeInteger(body.days) ||
        (body.days as number) <= 0 ||
        (body.days as number) > 2147483647)
    ) {
      return invalid('Choose No Expiry or a positive whole number of days.')
    }
    if (typeof body.bindLegacy !== 'boolean') return invalid('bindLegacy must be a boolean.')
    const accessVersion = await service.setCharacterAccess({
      ...common,
      roles: body.roles,
      specialCapabilities: body.specialCapabilities,
      days: body.days as number | null,
      bindLegacy: body.bindLegacy,
    })
    return success({ accessVersion })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
