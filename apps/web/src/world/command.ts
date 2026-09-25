import { validCell } from './travel'
import type { WorldCommand, WorldIntent, WorldPosition, WorldRoutePreviewRequest } from './types'
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

function parsePosition(value: unknown): WorldPosition | null {
  if (!object(value)) return null
  if (
    typeof value.sectorId !== 'string' ||
    value.sectorId.length > 64 ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    !validCell({ x: value.x, y: value.y })
  )
    return null
  return { sectorId: value.sectorId, x: value.x, y: value.y }
}

export function parseWorldRoutePreviewRequest(value: unknown): WorldRoutePreviewRequest | null {
  if (
    !object(value) ||
    value.operation !== 'preview-route' ||
    !Number.isSafeInteger(value.expectedVersion) ||
    (value.expectedVersion as number) < 1 ||
    !uuid(value.characterId)
  )
    return null
  const destination = parsePosition(value.destination)
  if (!destination) return null
  return {
    operation: 'preview-route',
    characterId: value.characterId,
    expectedVersion: value.expectedVersion as number,
    destination,
  }
}
export function parseWorldCommand(value: unknown): WorldCommand | null {
  if (
    !object(value) ||
    !Number.isSafeInteger(value.expectedVersion) ||
    (value.expectedVersion as number) < 1 ||
    !uuid(value.commandId) ||
    !uuid(value.characterId) ||
    !object(value.intent)
  )
    return null
  const input = value.intent
  let intent: WorldIntent
  if (input.kind === 'tick' || input.kind === 'stop' || input.kind === 'cross')
    intent = { kind: input.kind }
  else if (input.kind === 'walk') {
    const destination = parsePosition(input.destination)
    if (!destination) return null
    intent = { kind: 'walk', destination }
  } else if (
    input.kind === 'interact' &&
    typeof input.interactionId === 'string' &&
    /^[a-z0-9][a-z0-9-]{0,99}$/.test(input.interactionId)
  )
    intent = { kind: 'interact', interactionId: input.interactionId }
  else if (
    input.kind === 'autopath' &&
    typeof input.objectiveId === 'string' &&
    input.objectiveId.length <= 100
  )
    intent = { kind: 'autopath', objectiveId: input.objectiveId }
  else if (input.kind === 'attack' && uuid(input.targetId))
    intent = { kind: 'attack', targetId: input.targetId }
  else return null
  return {
    characterId: value.characterId,
    expectedVersion: value.expectedVersion as number,
    commandId: value.commandId,
    intent,
  }
}
