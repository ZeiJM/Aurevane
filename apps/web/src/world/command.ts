import { validCell } from './travel'
import type { WorldCommand, WorldIntent, WorldRestorationActionId } from './types'
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
export const isWorldUuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
export const PERSONAL_QUEST_INTERACTION_PREFIX = 'quest-run-'
export function personalQuestRunId(interactionId: string): string | null {
  if (!interactionId.startsWith(PERSONAL_QUEST_INTERACTION_PREFIX)) return null
  const runId = interactionId.slice(PERSONAL_QUEST_INTERACTION_PREFIX.length)
  return isWorldUuid(runId) ? runId : null
}
export function isWorldRestorationAction(value: unknown): value is WorldRestorationActionId {
  return (
    value === 'choose-restoration' ||
    value === 'choose-restoration-trial' ||
    value === 'restore-item' ||
    value === 'claim-restoration'
  )
}
export function parseWorldCommand(value: unknown): WorldCommand | null {
  if (
    !object(value) ||
    !Number.isSafeInteger(value.expectedVersion) ||
    (value.expectedVersion as number) < 1 ||
    !isWorldUuid(value.commandId) ||
    !isWorldUuid(value.characterId) ||
    !object(value.intent)
  )
    return null
  const input = value.intent
  let intent: WorldIntent
  if (
    input.kind === 'tick' ||
    input.kind === 'stop' ||
    input.kind === 'cross' ||
    input.kind === 'board-ferry' ||
    input.kind === 'leave-ferry'
  )
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
    input.kind === 'interact' &&
    typeof input.interactionId === 'string' &&
    /^[a-z0-9][a-z0-9-]{0,99}$/.test(input.interactionId) &&
    (input.actionId === undefined ||
      input.actionId === 'accept' ||
      input.actionId === 'report' ||
      input.actionId === 'hand-over' ||
      input.actionId === 'claim-exchange' ||
      input.actionId === 'travel-realm' ||
      input.actionId === 'leave-realm' ||
      input.actionId === 'challenge-realm' ||
      input.actionId === 'challenge-npc' ||
      (isWorldRestorationAction(input.actionId) &&
        personalQuestRunId(input.interactionId) !== null))
  )
    intent = {
      kind: 'interact',
      interactionId: input.interactionId,
      ...(input.actionId === undefined ? {} : { actionId: input.actionId }),
    }
  else if (
    input.kind === 'autopath' &&
    typeof input.objectiveId === 'string' &&
    input.objectiveId.length <= 100
  )
    intent = { kind: 'autopath', objectiveId: input.objectiveId }
  else if (input.kind === 'attack' && isWorldUuid(input.targetId))
    intent = { kind: 'attack', targetId: input.targetId }
  else return null
  return {
    characterId: value.characterId,
    expectedVersion: value.expectedVersion as number,
    commandId: value.commandId,
    intent,
  }
}
