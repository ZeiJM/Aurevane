import type { IdempotentCommandInput, TransactionalCommandResult } from './transactional-command'

export interface LevelProgressionCurveRecord {
  version: number
  maxLevel: number
  cumulativeXpByLevel: readonly number[]
}

export interface CharacterXpGrantRecord {
  grantId: string
  characterId: string
  progressionCycle: number
  curveVersion: number
  authorityKey: string
  sourceKind: string
  sourceId: string
  reasonTag: string
  requestedAmount: number
  appliedAmount: number
  xpBefore: number
  xpAfter: number
  levelBefore: number
  levelAfter: number
  reachedLevel: number | null
  secondsSinceCycleStart: number
  createdAt: string
}

export interface GrantCharacterXpInput extends IdempotentCommandInput {
  characterId: string
  authorityKey: string
  sourceKind: string
  sourceId: string
  reasonTag: string
  amount: number
}

export interface ProgressionRepository {
  loadCurveForCycle(cycleNumber: number): Promise<LevelProgressionCurveRecord>
  grantCharacterXp(
    input: GrantCharacterXpInput,
  ): Promise<TransactionalCommandResult<CharacterXpGrantRecord>>
}
