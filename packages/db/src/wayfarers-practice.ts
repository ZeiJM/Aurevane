import type { IdempotentCommandInput, TransactionalCommandResult } from './transactional-command'

export type WayfarersPracticeFocusRecord = 'balanced'
export type TrainingReportStatusRecord = 'pending' | 'claimed'

export interface TrainingReportRecord {
  reportId: string
  characterId: string
  userId: string
  focus: WayfarersPracticeFocusRecord
  configVersion: number
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
  claimTrainingReport(
    input: ClaimTrainingReportInput,
  ): Promise<TransactionalCommandResult<TrainingReportClaimRecord>>
}
