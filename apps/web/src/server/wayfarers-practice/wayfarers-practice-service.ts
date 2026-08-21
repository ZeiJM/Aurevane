import 'server-only'

import { createHash } from 'node:crypto'

import type {
  PlannedPracticeWindowRecord,
  SetPracticePlanRecord,
  TrainingReportClaimRecord,
  TrainingReportRecord,
  WayfarersPracticeRepository,
  WayfarersPracticeStatusRecord,
} from '@aurevane/db/wayfarers-practice'
import {
  createCharacterLevelUpEvent,
  type CharacterLevelUpEvent,
} from '@aurevane/game-core/character/progression'
import {
  BALANCED_PRACTICE_FOCUS,
  PHASE_1_BALANCED_PRACTICE_CONFIG,
  PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG,
  calculateBalancedPractice,
  getPassiveTrainingXpPerHour,
  getPlannedPracticeWindowSeconds,
  resolvePhase1PracticeIntent,
} from '@aurevane/game-core/character/wayfarers-practice'
import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { toUserActorKey } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'

const CLAIM_TRAINING_REPORT_COMMAND = 'wayfarers_practice.claim.v1'
const SET_PRACTICE_PLAN_COMMAND = 'wayfarers_practice.set_plan.v1'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ClaimTrainingReportCommand {
  actor: AuthenticatedActor
  characterId: string
  reportId: string
  idempotencyKey: string
}

export interface SetPracticePlanCommand {
  actor: AuthenticatedActor
  characterId: string
  plannedWindow: PlannedPracticeWindowRecord
  idempotencyKey: string
}

export interface ClaimTrainingReportOutcome {
  claim: TrainingReportClaimRecord
  replayed: boolean
  levelUpEvent: CharacterLevelUpEvent | null
}

export interface SetPracticePlanOutcome {
  plan: SetPracticePlanRecord
  replayed: boolean
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
  if (!report) return null

  validateTrainingReport(report, actor, characterId)
  return report
}

export async function loadPracticeStatus(
  actor: AuthenticatedActor,
  characterId: string,
  repository: WayfarersPracticeRepository,
): Promise<WayfarersPracticeStatusRecord> {
  validateUuid(characterId, 'character')
  const status = await repository.getPracticeStatus({ userId: actor.userId, characterId })
  validatePracticeStatus(status, actor, characterId)
  return status
}

export function isPassiveTrainingActive(status: WayfarersPracticeStatusRecord): boolean {
  if (!status.plannedWindow || !status.planSetAt || !status.plannedWindowSeconds) return false
  const startedAt = Date.parse(status.planSetAt)
  const serverNow = Date.parse(status.serverNow)
  return serverNow < startedAt + status.plannedWindowSeconds * 1000
}

export function passiveTrainingEndsAt(status: WayfarersPracticeStatusRecord): string | null {
  if (!status.plannedWindow || !status.planSetAt || !status.plannedWindowSeconds) return null
  return new Date(Date.parse(status.planSetAt) + status.plannedWindowSeconds * 1000).toISOString()
}

export async function setPracticePlan(
  command: SetPracticePlanCommand,
  repository: WayfarersPracticeRepository,
): Promise<SetPracticePlanOutcome> {
  validateUuid(command.characterId, 'character')
  validateUuid(command.idempotencyKey, 'idempotency key')
  const expectedSeconds = getPlannedPracticeWindowSeconds(command.plannedWindow)
  const actorKey = toUserActorKey(command.actor)
  const requestFingerprint = createHash('sha256')
    .update(
      JSON.stringify({ characterId: command.characterId, plannedWindow: command.plannedWindow }),
    )
    .digest('hex')

  const outcome = await repository.setPracticePlan({
    actorKey,
    commandName: SET_PRACTICE_PLAN_COMMAND,
    idempotencyKey: command.idempotencyKey,
    requestFingerprint,
    userId: command.actor.userId,
    characterId: command.characterId,
    plannedWindow: command.plannedWindow,
  })

  validateSetPracticePlanRecord(outcome.result, command, expectedSeconds)
  return { plan: outcome.result, replayed: outcome.replayed }
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
    .update(JSON.stringify({ characterId: command.characterId, reportId: command.reportId }))
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

  if (report.practiceSource === 'passive_training') {
    validatePassiveTrainingReport(report, windowStartMs, windowEndMs)
    return
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

  if (report.practiceSource === 'automatic_balanced') {
    const intent = resolvePhase1PracticeIntent({
      elapsedSeconds: report.elapsedSeconds,
      plannedWindow: null,
    })
    if (
      report.plannedWindow !== null ||
      report.plannedWindowConfigVersion !== null ||
      report.plannedWindowSeconds !== null ||
      report.plannedElapsedSeconds !== intent.plannedElapsedSeconds ||
      report.balancedFallbackSeconds !== intent.balancedFallbackSeconds
    ) {
      throw persistenceUnavailable()
    }
    return
  }

  if (
    report.practiceSource !== 'planned_balanced' ||
    report.plannedWindow === null ||
    report.plannedWindowConfigVersion !== PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG.version
  ) {
    throw persistenceUnavailable()
  }

  const intent = resolvePhase1PracticeIntent({
    elapsedSeconds: report.elapsedSeconds,
    plannedWindow: report.plannedWindow,
  })
  if (
    report.plannedWindowSeconds !== intent.plannedWindowSeconds ||
    report.plannedElapsedSeconds !== intent.plannedElapsedSeconds ||
    report.balancedFallbackSeconds !== intent.balancedFallbackSeconds
  ) {
    throw persistenceUnavailable()
  }
}

function validatePassiveTrainingReport(
  report: TrainingReportRecord,
  windowStartMs: number,
  windowEndMs: number,
): void {
  if (
    report.plannedWindow === null ||
    report.plannedWindowConfigVersion !== PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG.version
  ) {
    throw persistenceUnavailable()
  }

  const plannedSeconds = getPlannedPracticeWindowSeconds(report.plannedWindow)
  const measuredSeconds = Math.floor((windowEndMs - windowStartMs) / 1000)
  if (
    !Number.isSafeInteger(measuredSeconds) ||
    measuredSeconds < 0 ||
    measuredSeconds > plannedSeconds
  ) {
    throw persistenceUnavailable()
  }
  const expectedXp = Math.floor(
    (measuredSeconds * getPassiveTrainingXpPerHour(report.plannedWindow)) / 3600,
  )

  if (
    report.plannedWindowSeconds !== plannedSeconds ||
    report.elapsedSeconds !== measuredSeconds ||
    report.creditedDirectSeconds !== measuredSeconds ||
    report.fullRateSeconds !== measuredSeconds ||
    report.reducedRateSeconds !== 0 ||
    report.requestedCharacterXp !== expectedXp ||
    report.directXpCapReached ||
    report.restedMomentumSeconds !== 0 ||
    report.restedMomentumGain !== 0 ||
    report.restedMomentumCapReached ||
    report.plannedElapsedSeconds !== measuredSeconds ||
    report.balancedFallbackSeconds !== 0
  ) {
    throw persistenceUnavailable()
  }
}

function validatePracticeStatus(
  status: WayfarersPracticeStatusRecord,
  actor: AuthenticatedActor,
  characterId: string,
): void {
  if (status.userId !== actor.userId || status.characterId !== characterId) {
    throw new AurevaneError(
      'FORBIDDEN',
      'That Passive Training state does not belong to this account.',
    )
  }
  if (
    status.focus !== BALANCED_PRACTICE_FOCUS ||
    status.configVersion !== PHASE_1_BALANCED_PRACTICE_CONFIG.version ||
    status.minimumOfflineSeconds !== 0 ||
    status.shortWindowSeconds !== PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG.shortSeconds ||
    status.overnightWindowSeconds !== PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG.overnightSeconds ||
    status.extendedWindowSeconds !== PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG.extendedSeconds ||
    !isNonNegativeSafeInteger(status.restedMomentumBalance) ||
    !Number.isSafeInteger(Date.parse(status.serverNow))
  ) {
    throw persistenceUnavailable()
  }

  if (status.plannedWindow === null) {
    if (
      status.plannedWindowConfigVersion !== null ||
      status.plannedWindowSeconds !== null ||
      status.planSetAt !== null
    ) {
      throw persistenceUnavailable()
    }
    return
  }

  if (
    status.plannedWindowConfigVersion !== PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG.version ||
    status.plannedWindowSeconds !== getPlannedPracticeWindowSeconds(status.plannedWindow) ||
    status.planSetAt === null ||
    !Number.isSafeInteger(Date.parse(status.planSetAt))
  ) {
    throw persistenceUnavailable()
  }
}

function validateSetPracticePlanRecord(
  plan: SetPracticePlanRecord,
  command: SetPracticePlanCommand,
  expectedSeconds: number,
): void {
  if (
    plan.userId !== command.actor.userId ||
    plan.characterId !== command.characterId ||
    plan.plannedWindow !== command.plannedWindow
  ) {
    throw new AurevaneError('FORBIDDEN', 'The Passive Training plan ownership was invalid.')
  }
  if (
    plan.plannedWindowConfigVersion !== PHASE_1_PLANNED_PRACTICE_WINDOW_CONFIG.version ||
    plan.plannedWindowSeconds !== expectedSeconds ||
    !Number.isSafeInteger(Date.parse(plan.planSetAt)) ||
    !Number.isSafeInteger(Date.parse(plan.serverNow))
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
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Passive Training is unavailable right now.')
}
