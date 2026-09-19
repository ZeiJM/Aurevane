import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'

import {
  EVENT_OPERATION_COMMANDS,
  type EventOperationCommand,
  type EventOperationsService,
} from './event-operations-service'
import { createServerEventOperationsService } from './event-operations-server'

export interface EventOperationsHandlerDependencies {
  getActor(): Promise<{ userId: string }>
  createService(): EventOperationsService
}

const defaultDependencies: EventOperationsHandlerDependencies = {
  getActor: getAuthenticatedActor,
  createService: createServerEventOperationsService,
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

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    return invalid(`${field} must be a positive integer.`)
  }
  return value as number
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return invalid(`${field} must be a non-negative integer.`)
  }
  return value as number
}

function operationCommand(value: unknown): EventOperationCommand {
  const candidate = requiredString(value, 'command')
  if (!(EVENT_OPERATION_COMMANDS as readonly string[]).includes(candidate)) {
    return invalid('Unsupported Event operations command.')
  }
  return candidate as EventOperationCommand
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

export async function handleEventOperationsRequest(
  request: Request,
  dependencies: EventOperationsHandlerDependencies = defaultDependencies,
): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      throw new AurevaneError('INVALID_REQUEST', 'Live Event operations requires POST.')
    }

    const actor = await dependencies.getActor()
    const service = dependencies.createService()
    await service.requireOperator(actor.userId)
    const body = await readBody(request)
    const operation = requiredString(body.operation, 'operation')

    if (operation === 'list') {
      return success({ runs: await service.listRuns(actor.userId) })
    }

    if (operation === 'read') {
      const runId = requiredString(body.runId, 'runId')
      return success({ dashboard: await service.readDashboard(actor.userId, runId) })
    }

    if (operation === 'operate') {
      const result = await service.operate({
        actorUserId: actor.userId,
        runId: requiredString(body.runId, 'runId'),
        expectedStateVersion: positiveInteger(
          body.expectedStateVersion,
          'expectedStateVersion',
        ),
        idempotencyKey: requiredString(body.idempotencyKey, 'idempotencyKey'),
        command: operationCommand(body.command),
        reason: requiredString(body.reason, 'reason'),
      })
      return success({ result })
    }

    if (operation === 'advance-phase') {
      const result = await service.advancePhase({
        actorUserId: actor.userId,
        runId: requiredString(body.runId, 'runId'),
        expectedStateVersion: positiveInteger(
          body.expectedStateVersion,
          'expectedStateVersion',
        ),
        idempotencyKey: requiredString(body.idempotencyKey, 'idempotencyKey'),
        reason: requiredString(body.reason, 'reason'),
      })
      return success({ result })
    }

    if (operation === 'complete-cleanup') {
      const result = await service.completeCleanup({
        actorUserId: actor.userId,
        runId: requiredString(body.runId, 'runId'),
        phaseId: requiredString(body.phaseId, 'phaseId'),
        effectOrdinal: nonNegativeInteger(body.effectOrdinal, 'effectOrdinal'),
        completionKey: requiredString(body.completionKey, 'completionKey'),
        note: requiredString(body.note, 'note'),
      })
      return success({ result })
    }

    throw new AurevaneError('INVALID_REQUEST', 'Unsupported Live Event operation.')
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
