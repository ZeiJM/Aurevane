import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'

import { createServerCombatContentAuthoringService } from './combat-content-authoring-server'
import type { CombatContentAuthoringService } from './combat-content-authoring-service'
import { readCombatContentEventSample } from './combat-content-event-sample'

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

function readOptionalPreviewSeed(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 0xffff_ffff) {
    return invalid('seed must be a non-zero uint32 integer.')
  }
  return value as number
}

type AuthoringContentKind = 'skill' | 'essence' | 'resonance'

function readAuthoringContentKind(value: unknown): AuthoringContentKind {
  if (value === undefined) return 'skill'
  if (value !== 'skill' && value !== 'essence' && value !== 'resonance') {
    return invalid('contentKind must be skill, essence, or resonance.')
  }
  return value
}

function readOptionalCombatContext(value: unknown): 'pve' | 'pvp' | undefined {
  if (value === undefined) return undefined
  if (value !== 'pve' && value !== 'pvp') {
    return invalid('combatContext must be pve or pvp.')
  }
  return value
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
    if (
      operation === 'rollback' ||
      operation === 'restore-basic-draft' ||
      (operation === 'record' && isObject(body.command) && body.command.action === 'restore')
    ) {
      invalid('Content rollback is no longer available. Edit the current settings and Commit Now.')
    }
    if (operation === 'record') {
      if (
        Object.keys(body).some((key) => !['operation', 'command'].includes(key)) ||
        !service.recordCommand
      )
        invalid('A supported complete-record command is required.')
      const result: unknown = await service.recordCommand(requireProperty(body, 'command'))
      if (isObject(result) && isObject(result.record)) {
        const record = { ...result.record, history: [] }
        delete (record as JsonObject).builtinRestoreVersion
        return success({ ...result, record })
      }
      return success(result)
    }
    const contentKind = readAuthoringContentKind(body.contentKind)

    if (operation === 'validate') {
      const definition = requireProperty(body, 'definition')
      const validation =
        contentKind === 'skill'
          ? service.validateSkillDefinition(definition)
          : contentKind === 'essence'
            ? service.validateEssenceDefinition(definition)
            : service.validateResonanceDefinition(definition)
      return success({ validation })
    }

    if (operation === 'diff') {
      const before = requireProperty(body, 'before')
      const after = requireProperty(body, 'after')
      return success({ diff: service.diffSkillDefinitions(before, after) })
    }

    if (operation === 'preview') {
      const definition = requireProperty(body, 'definition')
      const seed = readOptionalPreviewSeed(body.seed)
      const combatContext = readOptionalCombatContext(body.combatContext)
      const behaviorId =
        body.behaviorId === undefined ? undefined : requiredString(body.behaviorId, 'behaviorId')
      const previewSetupSkillId =
        body.previewSetupSkillId === undefined
          ? undefined
          : requiredString(body.previewSetupSkillId, 'previewSetupSkillId')
      const previewRootSkillId =
        body.previewRootSkillId === undefined
          ? undefined
          : requiredString(body.previewRootSkillId, 'previewRootSkillId')
      const previewRootBehaviorId =
        body.previewRootBehaviorId === undefined
          ? undefined
          : requiredString(body.previewRootBehaviorId, 'previewRootBehaviorId')
      const preview = await service.previewSkillDefinition({
        ...(body.eventSample === undefined
          ? {}
          : { eventSample: readCombatContentEventSample(body.eventSample) }),
        ...(contentKind === 'resonance' ? { contentKind } : {}),
        actorUserId: actor.userId,
        definition,
        ...(seed === undefined ? {} : { seed }),
        ...(behaviorId === undefined ? {} : { behaviorId }),
        ...(previewSetupSkillId === undefined ? {} : { previewSetupSkillId }),
        ...(previewRootSkillId === undefined ? {} : { previewRootSkillId }),
        ...(previewRootBehaviorId === undefined ? {} : { previewRootBehaviorId }),
        ...(combatContext === undefined ? {} : { combatContext }),
      })
      return success({ preview })
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
      const input = {
        actorUserId: actor.userId,
        definition,
        baseVersion,
        expectedDraftVersion,
      }
      const draft =
        contentKind === 'skill'
          ? await service.saveSkillDraft(input)
          : contentKind === 'essence'
            ? await service.saveEssenceDraft(input)
            : await service.saveResonanceDraft(input)
      return success({ draft })
    }

    if (operation === 'publish') {
      const definition = requireProperty(body, 'definition')
      const expectedBaseVersion = readNullablePositiveInteger(
        requireProperty(body, 'expectedBaseVersion'),
        'expectedBaseVersion',
      )
      const input = {
        actorUserId: actor.userId,
        definition,
        expectedBaseVersion,
      }
      const published =
        contentKind === 'skill'
          ? await service.publishSkill(input)
          : contentKind === 'essence'
            ? await service.publishEssence(input)
            : await service.publishResonance(input)
      return success({ published })
    }

    throw new AurevaneError('INVALID_REQUEST', 'Unsupported Master Panel authoring operation.')
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
