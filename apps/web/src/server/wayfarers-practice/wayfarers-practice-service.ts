import 'server-only'

import { createHash } from 'node:crypto'

import type {
  TrainingReportClaimRecord,
  TrainingReportRecord,
  WayfarersPracticeRepository,
} from '@aurevane/db/wayfarers-practice'
import {
  createCharacterLevelUpEvent,
  type CharacterLevelUpEvent,
} from '@aurevane/game-core/character/progression'
import {
  BALANCED_PRACTICE_FOCUS,
  PHASE_1_BALANCED_PRACTICE_CONFIG,
  calculateBalancedPractice,
} from '@aurevane/game-core/character/wayfarers-practice'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { toUserActorKey } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'

const CLAIM_TRAINING_REPORT_COMMAND = 'wayfarers_practice.claim.v1'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ClaimTrainingReportCommand {
  actor: AuthenticatedActor
  characterId: string
  reportId: string
  idempotencyKey: string
}

export interface ClaimTrainingReportOutcome {
  claim: TrainingReportClaimRecord
  replayed: boolean
  levelUpEvent: CharacterLevelUpEvent | null
}

export async function loadTrainingReport(
  actor: AuthenticatedActor,
  characterId: string,
  repository: WayfarersPracticeRepository,
): Promise<TrainingReportRecord | null> {
  validateUuid(characterId, 'character')

  const report = await repository.materializeTrainingReport({
    userId: actor.userId,
    characterId,
  })
  if (!report) {
    return null
  }

  validateTrainingReport(report, actor, characterId)
  return report
}

export async function claimTrainingReport(
  command: ClaimTrainingReportCommand,
  repository: WayfarersPracticeRepository,
): Promise<ClaimTrainingReportOutcome> {
  validateUuid(command.characterId, 'character')
  validateUuid(command.reportId, 'Training Report')
  validateUuid(command.idempotencyKey, 'idempotency key')

  const actorKey = toUserActorKey(command.actor)
  const requestFingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        characterId: command.characterId,
        reportId: command.reportId,
      }),
    )
    .digest('hex')

  const outcome = await repository.claimTrainingReport({
    actorKey,
    commandName: CLAIM_TRAINING_REPORT_COMMAND,
    idempotencyKey: command.idempotencyKey,
    requestFingerprint,
    userId: command.actor.userId,
    characterId: command.characterId,
    reportId: command.reportId,
  })

  validateClaimRecord(outcome.result, command)

  return {
    claim: outcome.result,
    replayed: outcome.replayed,
    levelUpEvent: outcome.replayed
      ? null
      : createCharacterLevelUpEvent({
          characterId: outcome.result.characterId,
          progressionCycle: outcome.result.progressionCycle,
          curveVersion: outcome.result.curveVersion,
          levelBefore: outcome.result.levelBefore,
          levelAfter: outcome.result.levelAfter,
        }),
  }
}

function validateTrainingReport(
  report: TrainingReportRecord,
  actor: AuthenticatedActor,
  characterId: string,
): void {
  if (report.userId !== actor.userId || report.characterId !== characterId) {
    throw new AurevaneError('FORBIDDEN', 'That Training Report does not belong to this account.')
  }

  if (
    report.focus !== BALANCED_PRACTICE_FOCUS ||
    report.configVersion !== PHASE_1_BALANCED_PRACTICE_CONFIG.version ||
    (report.status !== 'pending' && report.status !== 'claimed')
  ) {
    throw persistenceUnavailable()
  }

  const windowStartMs = Date.parse(report.windowStartedAt)
  const windowEndMs = Date.parse(report.windowEndedAt)
  if (!Number.isSafeInteger(windowStartMs) || !Number.isSafeInteger(windowEndMs)) {
    throw persistenceUnavailable()
  }

  let calculated
  try {
    calculated = calculateBalancedPractice({ windowStartMs, windowEndMs })
  } catch {
    throw persistenceUnavailable()
  }

  if (
    report.elapsedSeconds !== calculated.window.elapsedSeconds ||
    report.creditedDirectSeconds !== calculated.creditedDirectSeconds ||
    report.fullRateSeconds !== calculated.fullRateSeconds ||
    report.reducedRateSeconds !== calculated.reducedRateSeconds ||
    report.requestedCharacterXp !== calculated.requestedCharacterXp ||
    report.directXpCapReached !== (calculated.directXpCapState === 'reached') ||
    report.restedMomentumSeconds !== calculated.restedMomentumSeconds ||
    report.restedMomentumGain !== calculated.restedMomentumGain ||
    report.restedMomentumCapReached !== (calculated.restedMomentumCapState === 'reached')
  ) {
    throw persistenceUnavailable()
  }
}

function validateClaimRecord(
  claim: TrainingReportClaimRecord,
  command: ClaimTrainingReportCommand,
): void {
  if (
    claim.userId !== command.actor.userId ||
    claim.characterId !== command.characterId ||
    claim.reportId !== command.reportId
  ) {
    throw new AurevaneError('FORBIDDEN', 'The Training Report claim ownership was invalid.')
  }

  if (
    !isNonNegativeSafeInteger(claim.requestedCharacterXp) ||
    !isNonNegativeSafeInteger(claim.appliedCharacterXp) ||
    claim.appliedCharacterXp > claim.requestedCharacterXp ||
    !isNonNegativeSafeInteger(claim.xpBefore) ||
    !isNonNegativeSafeInteger(claim.xpAfter) ||
    claim.xpAfter < claim.xpBefore ||
    !isPositiveSafeInteger(claim.progressionCycle) ||
    !isPositiveSafeInteger(claim.curveVersion) ||
    !isPositiveSafeInteger(claim.levelBefore) ||
    !isPositiveSafeInteger(claim.levelAfter) ||
    claim.levelAfter < claim.levelBefore ||
    !isNonNegativeSafeInteger(claim.restedMomentumBefore) ||
    !isNonNegativeSafeInteger(claim.restedMomentumApplied) ||
    !isNonNegativeSafeInteger(claim.restedMomentumAfter) ||
    claim.restedMomentumAfter !== claim.restedMomentumBefore + claim.restedMomentumApplied
  ) {
    throw persistenceUnavailable()
  }
}

function validateUuid(value: string, field: string): void {
  if (!uuidPattern.test(value)) {
    throw new AurevaneError('INVALID_REQUEST', `The ${field} identifier was not valid.`)
  }
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function persistenceUnavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    "Wayfarer's Practice is unavailable right now.",
  )
}
