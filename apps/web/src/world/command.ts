import { validCell } from './travel'
import type { WorldCommand, WorldIntent } from './types'
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
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
  else if (input.kind === 'walk' && object(input.destination)) {
    const p = input.destination
    if (
      typeof p.sectorId !== 'string' ||
      p.sectorId.length > 64 ||
      typeof p.x !== 'number' ||
      typeof p.y !== 'number' ||
      !validCell({ x: p.x, y: p.y })
    )
      return null
    intent = { kind: 'walk', destination: { sectorId: p.sectorId, x: p.x, y: p.y } }
  } else if (
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
