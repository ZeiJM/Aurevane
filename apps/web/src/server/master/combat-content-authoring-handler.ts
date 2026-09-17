import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'

import {
  createServerCombatContentAuthoringService,
} from './combat-content-authoring-server'
import type { CombatContentAuthoringService } from './combat-content-authoring-service'

export interface CombatContentAuthoringHandlerDependencies {
  getActor(): Promise<{ userId: string }>
  createService(actorUserId: string): CombatContentAuthoringService
}

const defaultDependencies: CombatContentAuthoringHandlerDependencies = {
  getActor: getAuthenticatedActor,
  createService: createServerCombatContentAuthoringService,
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(message: string): never {
  throw new AurevaneError('INVALID_REQUEST', message)
}

function readNullablePositiveInteger(value: unknown, field: string): number | null {
  if (value === null) return null
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    return invalid(`${field} must be null or a positive integer.`)
  }
  return value as number
}

function readPositiveInteger(value: unknown, field: string): number {
  const parsed = readNullablePositiveInteger(value, field)
  if (parsed === null) return invalid(`${field} must be a positive integer.`)
  return parsed
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return invalid(`${field} must be a non-empty string.`)
  }
  return value
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

export async function handleCombatContentAuthoringRequest(
  request: Request,
  dependencies: CombatContentAuthoringHandlerDependencies = defaultDependencies,
): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      throw new AurevaneError('INVALID_REQUEST', 'Master Panel authoring requires POST.')
    }

    const actor = await dependencies.getActor()
    const service = dependencies.createService(actor.userId)
    await service.requireOperator(actor.userId)
    const body = await readBody(request)
    const operation = requiredString(body.operation, 'operation')

    if (operation === 'validate') {
      const definition = requireProperty(body, 'definition')
      return success({ validation: service.validateSkillDefinition(definition) })
    }

    if (operation === 'diff') {
      const before = requireProperty(body, 'before')
      const after = requireProperty(body, 'after')
      return success({ diff: service.diffSkillDefinitions(before, after) })
    }

    if (operation === 'save-draft') {
      const definition = requireProperty(body, 'definition')
      const baseVersion = readNullablePositiveInteger(
        requireProperty(body, 'baseVersion'),
        'baseVersion',
      )
      const expectedDraftVersion = readNullablePositiveInteger(
        requireProperty(body, 'expectedDraftVersion'),
        'expectedDraftVersion',
      )
      const draft = await service.saveSkillDraft({
        actorUserId: actor.userId,
        definition,
        baseVersion,
        expectedDraftVersion,
      })
      return success({ draft })
    }

    if (operation === 'publish') {
      const definition = requireProperty(body, 'definition')
      const expectedBaseVersion = readNullablePositiveInteger(
        requireProperty(body, 'expectedBaseVersion'),
        'expectedBaseVersion',
      )
      const published = await service.publishSkill({
        actorUserId: actor.userId,
        definition,
        expectedBaseVersion,
      })
      return success({ published })
    }

    if (operation === 'rollback') {
      const skillId = requiredString(body.skillId, 'skillId')
      const targetVersion = readPositiveInteger(body.targetVersion, 'targetVersion')
      await service.rollbackSkill({
        actorUserId: actor.userId,
        skillId,
        targetVersion,
      })
      return success({ ok: true })
    }

    throw new AurevaneError('INVALID_REQUEST', 'Unsupported Master Panel authoring operation.')
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
