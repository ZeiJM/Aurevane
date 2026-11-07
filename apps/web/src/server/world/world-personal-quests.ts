import 'server-only'

import {
  isPersonalQuestGiver,
  PERSONAL_QUEST_GIVERS,
} from '@aurevane/game-core/events/persistent-event'
import { isWorldUuid } from '@/world/command'
import { validCell } from '@/world/travel'
import type { WorldInteraction, WorldObjective, WorldPosition } from '@/world/types'

const prefix = 'quest-run-'
export function personalQuestRunId(interactionId: string): string | null {
  const runId = interactionId.slice(prefix.length)
  return interactionId.startsWith(prefix) && isWorldUuid(runId) ? runId : null
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function position(value: unknown): WorldPosition | null {
  if (
    !object(value) ||
    typeof value.sectorId !== 'string' ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    !validCell({ x: value.x, y: value.y })
  )
    return null
  return { sectorId: value.sectorId, x: value.x, y: value.y }
}

export function projectPersonalQuests(rows: unknown): {
  objectives: WorldObjective[]
  interactions: WorldInteraction[]
} {
  const objectives: WorldObjective[] = []
  const interactions: WorldInteraction[] = []
  if (!Array.isArray(rows)) return { objectives, interactions }
  for (const row of rows.slice(0, 48)) {
    if (
      !object(row) ||
      !isWorldUuid(row.runId) ||
      typeof row.title !== 'string' ||
      typeof row.body !== 'string' ||
      !isPersonalQuestGiver(row.giverId)
    )
      continue
    const progress = row.progress
    if (
      progress !== 'available' &&
      progress !== 'active' &&
      progress !== 'ready' &&
      progress !== 'completed'
    )
      continue

    const id = prefix + row.runId
    const title = row.title.slice(0, 120)
    const body = row.body.slice(0, 800)
    const reward =
      progress === 'completed' &&
      typeof row.awardedXp === 'number' &&
      Number.isSafeInteger(row.awardedXp) &&
      row.awardedXp > 0
        ? ` ${row.awardedXp} Character XP earned.`
        : ''
    const inputQuantity = row.inputQuantity
    const inputName = row.inputName
    const outputName = row.outputName
    const exchange =
      typeof inputQuantity === 'number' &&
      Number.isSafeInteger(inputQuantity) &&
      inputQuantity >= 1 &&
      inputQuantity <= 999 &&
      typeof inputName === 'string' &&
      typeof outputName === 'string'
        ? { inputQuantity, inputName, outputName }
        : null
    let description = body + reward
    if (exchange && progress === 'completed') {
      description +=
        row.itemClaimPending === true
          ? ` Return to ${PERSONAL_QUEST_GIVERS[row.giverId].label} to collect ${exchange.outputName}.`
          : ' Access granted.'
    } else if (exchange) {
      const owned = typeof row.inputOwned === 'number' ? row.inputOwned : 0
      description += ` ${exchange.inputName}: ${owned} / ${exchange.inputQuantity}. Reward: ${exchange.outputName}.`
    }
    const destination = position(row.destination)
    objectives.push({
      id,
      name: title,
      description,
      kind: 'quest',
      authority: 'personal-quest',
      autoPath: destination !== null,
      guidance: 'exact',
      destination,
      completed: progress === 'completed',
      progress,
    })
    if (row.local !== true) continue
    const handOver = exchange ? `Hand over ${exchange.inputQuantity} ${exchange.inputName}` : null
    const responses = {
      accept: 'Accept quest',
      report: 'Report back',
      'hand-over': handOver,
      'claim-exchange': exchange ? `Collect ${exchange.outputName}` : null,
    }
    const actionId =
      (progress === 'available' && row.action === 'accept') ||
      (progress === 'ready' &&
        (row.action === 'report' || (exchange && row.action === 'hand-over'))) ||
      (progress === 'completed' &&
        exchange &&
        row.itemClaimPending === true &&
        row.action === 'claim-exchange')
        ? row.action
        : null
    interactions.push({
      id,
      objectiveId: id,
      title,
      body: body + reward,
      progress,
      actionId,
      speakerId: row.giverId,
      speaker: PERSONAL_QUEST_GIVERS[row.giverId].speaker,
      actionLabel: actionId ? responses[actionId] : null,
      ...(handOver && progress !== 'available'
        ? { lastReply: progress === 'completed' ? handOver : responses.accept }
        : {}),
    })
  }
  return { objectives, interactions }
}
