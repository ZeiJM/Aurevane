import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'

import { createServerEventAuthoringService } from './event-authoring-server'
import type { EventAuthoringService } from './event-authoring-service'

export interface EventAuthoringHandlerDependencies {
  getActor(): Promise<{ userId: string }>
  createService(actorUserId: string): EventAuthoringService
}

const defaultDependencies: EventAuthoringHandlerDependencies = {
  getActor: getAuthenticatedActor,
  createService: createServerEventAuthoringService,
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(message: string): never {
  throw new AurevaneError('INVALID_REQUEST', message)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return invalid(`${field} must be a non-empty string.`)
  }
  return value
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  return requiredString(value, field)
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null
  return requiredString(value, field)
}

function nullablePositiveInteger(value: unknown, field: string): number | null {
  if (value === null) return null
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    return invalid(`${field} must be null or a positive integer.`)
  }
  return value as number
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = nullablePositiveInteger(value, field)
  if (parsed === null) return invalid(`${field} must be a positive integer.`)
  return parsed
}

function requireProperty(body: JsonObject, key: string): unknown {
  if (!Object.hasOwn(body, key)) return invalid(`${key} is required.`)
  return body[key]
}

async function readBody(request: Request): Promise<JsonObject> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalid('Request body must be valid JSON.')
  }
  if (!isObject(body)) return invalid('Request body must be a JSON object.')
  return body
}

function success(body: unknown): Response {
  return Response.json(body, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function handleEventAuthoringRequest(
  request: Request,
  dependencies: EventAuthoringHandlerDependencies = defaultDependencies,
): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      throw new AurevaneError('INVALID_REQUEST', 'Event Builder requires POST.')
    }

    const actor = await dependencies.getActor()
    const service = dependencies.createService(actor.userId)
    await service.requireAuthor(actor.userId)
    const body = await readBody(request)
    const operation = requiredString(body.operation, 'operation')

    if (operation === 'validate') {
      return success({
        validation: service.validateDefinition(requireProperty(body, 'definition')),
      })
    }

    if (operation === 'preview') {
      const preview = await service.previewDefinition({
        actorUserId: actor.userId,
        definition: requireProperty(body, 'definition'),
        phaseId: optionalString(body.phaseId, 'phaseId'),
        testClock: optionalString(body.testClock, 'testClock'),
      })
      return success({ preview })
    }

    if (operation === 'load') {
      const workspace = await service.loadWorkspace({
        actorUserId: actor.userId,
        eventKey: requiredString(body.eventKey, 'eventKey'),
      })
      return success({ workspace })
    }

    if (operation === 'save-draft') {
      const draft = await service.saveDraft({
        actorUserId: actor.userId,
        definition: requireProperty(body, 'definition'),
        baseVersion: nullablePositiveInteger(requireProperty(body, 'baseVersion'), 'baseVersion'),
        expectedDraftVersion: nullablePositiveInteger(
          requireProperty(body, 'expectedDraftVersion'),
          'expectedDraftVersion',
        ),
      })
      return success({ draft })
    }

    if (operation === 'publish') {
      const published = await service.publish({
        actorUserId: actor.userId,
        definition: requireProperty(body, 'definition'),
        expectedBaseVersion: nullablePositiveInteger(
          requireProperty(body, 'expectedBaseVersion'),
          'expectedBaseVersion',
        ),
      })
      return success({ published })
    }

    if (operation === 'schedule') {
      const scheduled = await service.schedule({
        actorUserId: actor.userId,
        eventKey: requiredString(body.eventKey, 'eventKey'),
        idempotencyKey: requiredString(body.idempotencyKey, 'idempotencyKey'),
        requestFingerprint: requiredString(body.requestFingerprint, 'requestFingerprint'),
        scheduledStartAt: requiredString(body.scheduledStartAt, 'scheduledStartAt'),
        scheduledEndAt: nullableString(
          requireProperty(body, 'scheduledEndAt'),
          'scheduledEndAt',
        ),
      })
      return success({ scheduled })
    }

    if (operation === 'cancel-scheduled') {
      const transition = await service.cancelScheduled({
        actorUserId: actor.userId,
        runId: requiredString(body.runId, 'runId'),
        expectedStateVersion: positiveInteger(body.expectedStateVersion, 'expectedStateVersion'),
        idempotencyKey: requiredString(body.idempotencyKey, 'idempotencyKey'),
        reason: requiredString(body.reason, 'reason'),
      })
      return success({ transition })
    }

    throw new AurevaneError('INVALID_REQUEST', 'Unsupported Event Builder operation.')
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
