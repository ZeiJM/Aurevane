import 'server-only'

import {
  isPersonalQuestGiver,
  PERSONAL_QUEST_GIVERS,
} from '@aurevane/game-core/events/persistent-event'
import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
import { isWorldUuid, PERSONAL_QUEST_INTERACTION_PREFIX } from '@/world/command'
import { validCell } from '@/world/travel'
import type { WorldInteraction, WorldObjective, WorldPosition } from '@/world/types'

const repeatablePrefix = 'repeatable-travel-'
function interactionReference(interactionId: string, idPrefix: string): string | null {
  const reference = interactionId.slice(idPrefix.length)
  return interactionId.startsWith(idPrefix) && isWorldUuid(reference) ? reference : null
}
export function repeatableTravelReference(interactionId: string): string | null {
  return interactionReference(interactionId, repeatablePrefix)
}
export function projectRepeatableTravel(rows: unknown) {
  return projectPersonalQuests(rows, repeatablePrefix)
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

export function projectPersonalQuests(
  rows: unknown,
  idPrefix = PERSONAL_QUEST_INTERACTION_PREFIX,
): {
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
      typeof row.body !== 'string'
    )
      continue
    const id = idPrefix + row.runId
    const title = row.title.slice(0, 120)
    const availableAt =
      idPrefix === repeatablePrefix && typeof row.nextAvailableAt === 'string'
        ? Date.parse(row.nextAvailableAt)
        : NaN
    const availability = Number.isFinite(availableAt)
      ? ` Available again ${new Intl.DateTimeFormat('en', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'UTC',
        }).format(availableAt)} UTC.`
      : ''
    const body = row.body.slice(0, 800) + availability
    const restoration =
      idPrefix === PERSONAL_QUEST_INTERACTION_PREFIX &&
      row.discovery === true &&
      isWorldUuid(row.giverId) &&
      typeof row.speaker === 'string' &&
      typeof row.firstName === 'string' &&
      typeof row.secondName === 'string' &&
      typeof row.outputName === 'string' &&
      (row.progress === 'active' || row.progress === 'ready' || row.progress === 'completed')
        ? {
            cost: `1 ${row.firstName} and 1 ${row.secondName}`,
            outputName: row.outputName,
            claimPending: row.progress === 'completed' && row.itemClaimPending === true,
          }
        : null
    if (row.discovery === true && !restoration) {
      objectives.push({
        id,
        name: title,
        description: body,
        kind: 'quest',
        authority: 'personal-quest',
        autoPath: false,
        guidance: 'clue',
        destination: null,
        completed: false,
        progress: 'active',
      })
      continue
    }
    if (
      !isPersonalQuestGiver(row.giverId) &&
      (!isWorldUuid(row.giverId) || typeof row.speaker !== 'string')
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
    const clue =
      restoration && progress === 'active' && typeof row.discoveryClue === 'string'
        ? row.discoveryClue.slice(0, 800)
        : ''
    let description = (clue && clue !== body ? `${clue} ${body}` : body) + reward
    if (restoration?.claimPending) {
      description += ` ${restoration.outputName} is reserved. You need an open Gear slot to collect it from ${speaker}.`
    } else if (restoration && progress === 'ready') {
      description += ` Restoration requires ${restoration.cost}.`
    } else if (exchange && row.accessGranted === true) {
      description +=
        row.itemClaimPending === true
          ? ` Return to ${giver?.label ?? speaker} to collect ${exchange.outputName}.`
          : ' Access granted.'
    } else if (exchange) {
      const owned = typeof row.inputOwned === 'number' ? row.inputOwned : 0
      description += ` ${exchange.inputName}: ${owned} / ${exchange.inputQuantity}. Reward: ${exchange.outputName}.`
    }
    const destination = position(row.destination)
    // The exchange is settled, but keep its owed weapon in the active journal.
    const displayedProgress = restoration?.claimPending ? 'ready' : progress
    objectives.push({
      id,
      name: title,
      description,
      kind: 'quest',
      authority: 'personal-quest',
      autoPath: destination !== null,
      guidance: 'exact',
      destination,
      completed: displayedProgress === 'completed',
      progress: displayedProgress,
    })
    if (row.local !== true) continue
    const handOver = exchange ? `Hand over ${exchange.inputQuantity} ${exchange.inputName}` : null
    const responses = {
      accept: idPrefix === repeatablePrefix ? 'Accept activity' : 'Accept quest',
      report: 'Report back',
      'hand-over': handOver,
      'claim-exchange': exchange ? `Collect ${exchange.outputName}` : null,
      'travel-realm': 'Travel to the realm',
      'leave-realm': 'Leave the realm',
      'challenge-realm': 'Challenge the guardian',
      'choose-restoration': 'Choose recovery route',
      'restore-item': restoration ? `Restore ${restoration.outputName}` : null,
      'claim-restoration': restoration ? `Collect ${restoration.outputName}` : null,
    }
    const actionId =
      (restoration &&
        ((progress === 'active' && row.action === 'choose-restoration') ||
          (progress === 'ready' && row.action === 'restore-item') ||
          (restoration.claimPending && row.action === 'claim-restoration'))) ||
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
      progress: displayedProgress,
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
      ...(actionId === 'restore-item' && restoration
        ? {
            confirmation: {
              prompt: `Hand over ${restoration.cost} to restore ${restoration.outputName}?`,
              label: 'Confirm restoration',
              cancelLabel: 'Keep them for now',
            },
          }
        : {}),
      ...(handOver && progress !== 'available'
        ? { lastReply: row.accessGranted === true ? handOver : responses.accept }
        : {}),
    })
  }
  return { objectives, interactions }
}
