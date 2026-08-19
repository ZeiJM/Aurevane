import type { IdempotentCommandInput, TransactionalCommandResult } from './transactional-command'

export type WayfarersPracticeFocusRecord = 'balanced'
export type TrainingReportStatusRecord = 'pending' | 'claimed'
export type PlannedPracticeWindowRecord = 'short' | 'overnight' | 'extended'
export type PracticeSourceRecord = 'automatic_balanced' | 'planned_balanced' | 'passive_training'

export interface TrainingReportRecord {
  reportId: string
  characterId: string
  userId: string
  focus: WayfarersPracticeFocusRecord
  configVersion: number
  practiceSource: PracticeSourceRecord
  plannedWindow: PlannedPracticeWindowRecord | null
  plannedWindowConfigVersion: number | null
  plannedWindowSeconds: number | null
  plannedElapsedSeconds: number
  balancedFallbackSeconds: number
  windowStartedAt: string
  windowEndedAt: string
  elapsedSeconds: number
  creditedDirectSeconds: number
  fullRateSeconds: number
  reducedRateSeconds: number
  requestedCharacterXp: number
  directXpCapReached: boolean
  restedMomentumSeconds: number
  restedMomentumGain: number
  restedMomentumCapReached: boolean
  status: TrainingReportStatusRecord
  createdAt: string
  claimedAt: string | null
}

export interface MaterializeTrainingReportInput {
  userId: string
  characterId: string
}

export interface WayfarersPracticeStatusRecord {
  characterId: string
  userId: string
  focus: WayfarersPracticeFocusRecord
  configVersion: number
  minimumOfflineSeconds: number
  restedMomentumBalance: number
  plannedWindow: PlannedPracticeWindowRecord | null
  plannedWindowConfigVersion: number | null
  plannedWindowSeconds: number | null
  planSetAt: string | null
  shortWindowSeconds: number
  overnightWindowSeconds: number
  extendedWindowSeconds: number
  serverNow: string
}

export interface GetWayfarersPracticeStatusInput {
  userId: string
  characterId: string
}

export interface SetPracticePlanRecord {
  characterId: string
  userId: string
  plannedWindow: PlannedPracticeWindowRecord
  plannedWindowConfigVersion: number
  plannedWindowSeconds: number
  planSetAt: string
  serverNow: string
}

export interface SetPracticePlanInput extends IdempotentCommandInput {
  userId: string
  characterId: string
  plannedWindow: PlannedPracticeWindowRecord
}

export interface TrainingReportClaimRecord {
  reportId: string
  characterId: string
  userId: string
  progressionCycle: number
  curveVersion: number
  xpGrantId: string | null
  requestedCharacterXp: number
  appliedCharacterXp: number
  xpBefore: number
  xpAfter: number
  levelBefore: number
  levelAfter: number
  reachedLevel: number | null
  restedMomentumBefore: number
  restedMomentumApplied: number
  restedMomentumAfter: number
  claimedAt: string
}

export interface ClaimTrainingReportInput extends IdempotentCommandInput {
  userId: string
  characterId: string
  reportId: string
}

export interface WayfarersPracticeRepository {
  materializeTrainingReport(
    input: MaterializeTrainingReportInput,
  ): Promise<TrainingReportRecord | null>
  getPracticeStatus(input: GetWayfarersPracticeStatusInput): Promise<WayfarersPracticeStatusRecord>
  setPracticePlan(
    input: SetPracticePlanInput,
  ): Promise<TransactionalCommandResult<SetPracticePlanRecord>>
  claimTrainingReport(
    input: ClaimTrainingReportInput,
  ): Promise<TransactionalCommandResult<TrainingReportClaimRecord>>
}
