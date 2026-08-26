import type { TransactionalCommandResult } from './transactional-command'

export type PersistedBattleLifecycle = 'pending' | 'active' | 'completed' | 'abandoned'

export interface BattleParticipantInput {
  combatantId: string
  participantRole: 'player' | 'opponent'
  characterId: string | null
}

export interface BattleSessionRecord {
  battleSessionId: string
  battleId: string
  battleVersion: number
  rulesVersion: number
  contentVersion: number
  lifecycle: PersistedBattleLifecycle
  snapshot: unknown
  controlledCombatantIds: readonly string[]
  updatedAt: string
}

export interface BattleSessionCreationRecord {
  battleSessionId: string
  battleVersion: number
  snapshot: unknown
  createdAt: string
}

export interface BattleSessionCommitRecord {
  battleSessionId: string
  battleVersion: number
  snapshot: unknown
  committedAt: string
}

export interface BattleEventRecord {
  battleVersion: number
  eventIndex: number
  event: unknown
  createdAt: string
}

export interface BattleEventCursor {
  battleVersion: number
  eventIndex: number
}

interface BattleIdempotentInput {
  actorKey: string
  idempotencyKey: string
  requestFingerprint: string
}

export interface CreateBattleSessionInput extends BattleIdempotentInput {
  userId: string
  battleId: string
  rulesVersion: number
  contentVersion: number
  initialSnapshot: unknown
  participants: readonly BattleParticipantInput[]
}

export interface FindBattleIntentReplayInput extends BattleIdempotentInput {
  userId: string
  battleSessionId: string
}

export interface CommitBattleIntentInput extends FindBattleIntentReplayInput {
  expectedBattleVersion: number
  nextSnapshot: unknown
  events: readonly unknown[]
}

export interface BattleSessionRepository {
  createBattleSession(
    input: CreateBattleSessionInput,
  ): Promise<TransactionalCommandResult<BattleSessionCreationRecord>>
  findBattleSession(userId: string, battleSessionId: string): Promise<BattleSessionRecord | null>
  findBattleIntentReplay(
    input: FindBattleIntentReplayInput,
  ): Promise<BattleSessionCommitRecord | null>
  commitBattleIntent(
    input: CommitBattleIntentInput,
  ): Promise<TransactionalCommandResult<BattleSessionCommitRecord>>
}

export interface BattleEventRepository {
  findBattleEvents(
    userId: string,
    battleSessionId: string,
    limit: number,
    before?: BattleEventCursor,
  ): Promise<readonly BattleEventRecord[]>
}
