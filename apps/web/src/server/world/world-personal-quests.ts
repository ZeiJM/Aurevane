import 'server-only'

import {
  isPersonalQuestGiver,
  PERSONAL_QUEST_GIVERS,
} from '@aurevane/game-core/events/persistent-event'
import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
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
      (!isPersonalQuestGiver(row.giverId) &&
        (!isWorldUuid(row.giverId) || typeof row.speaker !== 'string'))
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
    const giver = isPersonalQuestGiver(row.giverId) ? PERSONAL_QUEST_GIVERS[row.giverId] : null
    const speaker = typeof row.speaker === 'string' ? row.speaker.slice(0, 60) : giver?.speaker
    if (!speaker) continue
    const portraitRef =
      typeof row.portraitRef === 'string' && isStarterCharacterPortraitRef(row.portraitRef)
        ? row.portraitRef
        : null
    const portraitUrl =
      typeof row.speaker === 'string' && row.speaker !== 'Sealed realm gate'
        ? resolvePublicCharacterImageUrl(
            typeof row.portraitUrl === 'string' ? row.portraitUrl : null,
            portraitRef ?? 'portrait.starter.wayfarer-01',
          )
        : undefined
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
    if (exchange && row.accessGranted === true) {
      description +=
        row.itemClaimPending === true
          ? ` Return to ${giver?.label ?? speaker} to collect ${exchange.outputName}.`
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
      'travel-realm': 'Travel to the realm',
      'leave-realm': 'Leave the realm',
      'challenge-realm': 'Challenge the guardian',
    }
    const actionId =
      (progress === 'available' && row.action === 'accept') ||
      (progress === 'ready' &&
        (row.action === 'report' || (exchange && row.action === 'hand-over'))) ||
      (row.accessGranted === true &&
        (row.action === 'travel-realm' ||
          row.action === 'leave-realm' ||
          row.action === 'challenge-realm')) ||
      (row.accessGranted === true &&
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
      speaker,
      ...(portraitUrl ? { portraitUrl } : {}),
      ...(typeof row.lore === 'string' ? { lore: row.lore.slice(0, 800) } : {}),
      ...(row.alternativeAction === 'leave-realm' || row.alternativeAction === 'travel-realm'
        ? {
            alternative: {
              actionId: row.alternativeAction,
              label: responses[row.alternativeAction],
            },
          }
        : {}),
      ...(actionId === 'accept' && row.lore
        ? { declineLabel: 'Not now' }
        : actionId === 'hand-over' && row.lore
          ? { declineLabel: 'Keep them for now' }
          : actionId === 'travel-realm' || row.alternativeAction === 'travel-realm'
            ? { declineLabel: "I'll return later" }
            : {}),
      actionLabel: actionId ? responses[actionId] : null,
      ...(handOver && progress !== 'available'
        ? { lastReply: row.accessGranted === true ? handOver : responses.accept }
        : {}),
    })
  }
  return { objectives, interactions }
}
