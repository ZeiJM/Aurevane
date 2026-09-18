import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'

import { isDelegatedMasterPanelRole, type MasterPanelStaffAccessService } from './staff-access'
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
    return invalid(`${field} must be a non-empty string.`)
  }
  return value
}

function requiredUserId(value: unknown): string {
  const userId = requiredString(value, 'targetUserId')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return invalid('targetUserId must be a valid UUID.')
  }
  return userId
}

function optionalNote(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const note = requiredString(value, 'note')
  if (note.length > 240) return invalid('note must be 240 characters or fewer.')
  return note
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
    const targetUserId = requiredUserId(body.targetUserId)
    const role = requiredString(body.role, 'role')
    if (!isDelegatedMasterPanelRole(role)) {
      throw new AurevaneError(
        'INVALID_REQUEST',
        'role must be moderator, content-staff, or event-staff.',
      )
    }
    const note = optionalNote(body.note)

    if (operation === 'grant-role') {
      const accessVersion = await service.grantRole({
        actorUserId: actor.userId,
        targetUserId,
        role,
        note,
      })
      return success({ accessVersion })
    }

    if (operation === 'revoke-role') {
      const accessVersion = await service.revokeRole({
        actorUserId: actor.userId,
        targetUserId,
        role,
        note,
      })
      return success({ accessVersion })
    }

    throw new AurevaneError('INVALID_REQUEST', 'Unsupported Master Panel staff operation.')
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
