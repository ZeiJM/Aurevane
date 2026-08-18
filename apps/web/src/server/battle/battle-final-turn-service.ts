import 'server-only'

import { createHash } from 'node:crypto'

import type { BattleSessionRecord, BattleSessionRepository } from '@aurevane/db/battle-session'
import type { BattleFacing } from '@aurevane/game-core/combat/battle-state'
import { finishPv1fTurn } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'
import { createBattleSessionChangedInvalidation } from '@aurevane/realtime'

import type { BattleSessionProjection, BattleSessionView } from './battle-session-service'

export interface PreviewBattleFinalTurnCommand {
  userId: string
  battleSessionId: string
  expectedBattleVersion: number
  facing: BattleFacing
}

export interface CommitBattleFinalTurnCommand extends PreviewBattleFinalTurnCommand {
  idempotencyKey: string
}

export interface BattleFinalTurnPreviewView {
  battleSessionId: string
  battleVersion: number
  facing: BattleFacing
  legal: boolean
  issues: readonly { code: string; message: string }[]
}

export interface BattleFinalTurnService {
  previewFinalTurn(command: PreviewBattleFinalTurnCommand): Promise<BattleFinalTurnPreviewView>
  commitFinalTurn(command: CommitBattleFinalTurnCommand): Promise<BattleSessionView>
}

function battleUnavailable(): AurevaneError {
  return new AurevaneError('FORBIDDEN', 'That battle is not available to this account.')
}

function persistenceInvalid(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The stored battle state is invalid.')
}

function invalidFinalTurn(message = 'That final facing is not legal right now.'): AurevaneError {
  return new AurevaneError('INVALID_REQUEST', message)
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

function readPersistedEncounter(record: BattleSessionRecord): StatDrivenCombatEncounterState {
  const snapshot = record.snapshot
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw persistenceInvalid()
  }

  try {
    const candidate = snapshot as StatDrivenCombatEncounterState
    const issues = validateStatDrivenCombatEncounterState(candidate)
    if (issues.length > 0) throw persistenceInvalid()
    if (
      candidate.tactical.battle.battleId !== record.battleId ||
      candidate.tactical.battle.rulesVersion !== record.rulesVersion ||
      candidate.tactical.battle.contentVersion !== record.contentVersion
    ) {
      throw persistenceInvalid()
    }
    return candidate
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw persistenceInvalid()
  }
}

function assertControlledTurn(
  state: StatDrivenCombatEncounterState,
  controlledCombatantIds: readonly string[],
): void {
  const turn = state.tactical.battle.currentTurn
  if (
    controlledCombatantIds.length === 0 ||
    new Set(controlledCombatantIds).size !== controlledCombatantIds.length
  ) {
    throw persistenceInvalid()
  }
  if (state.tactical.battle.lifecycle !== 'active' || !turn) {
    throw invalidFinalTurn('That battle does not currently accept a final-facing command.')
  }
  if (!controlledCombatantIds.includes(turn.combatantId)) {
    throw new AurevaneError(
      'FORBIDDEN',
      'Final facing can be chosen only during the selected character’s turn.',
    )
  }
}

function resolveFinalTurn(
  state: StatDrivenCombatEncounterState,
  facing: BattleFacing,
): { state: StatDrivenCombatEncounterState; events: readonly unknown[] } {
  try {
    return finishPv1fTurn(state, facing)
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw invalidFinalTurn(error instanceof Error ? error.message : undefined)
  }
}

function projectBattleSnapshot(state: StatDrivenCombatEncounterState): BattleSessionProjection {
  const battle = state.tactical.battle
  return {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        schemaVersion: battle.schemaVersion,
        battleId: battle.battleId,
        rulesVersion: battle.rulesVersion,
        contentVersion: battle.contentVersion,
        lifecycle: battle.lifecycle,
        combatants: battle.combatants,
        initiativeOrder: battle.initiativeOrder,
        round: battle.round,
        turnNumber: battle.turnNumber,
        currentTurn: battle.currentTurn,
      },
    },
  }
}

function previewIssue(error: unknown): { code: string; message: string } {
  return {
    code: 'final-facing-not-legal',
    message: error instanceof Error ? error.message : 'That final facing is not legal right now.',
  }
}

export function createBattleFinalTurnService(
  battles: BattleSessionRepository,
): BattleFinalTurnService {
  return {
    async previewFinalTurn(command) {
      const record = await battles.findBattleSession(command.userId, command.battleSessionId)
      if (!record) throw battleUnavailable()
      if (record.battleVersion !== command.expectedBattleVersion) {
        throw new StaleBattleVersionError(record.battleVersion)
      }

      const state = readPersistedEncounter(record)
      assertControlledTurn(state, record.controlledCombatantIds)
      try {
        resolveFinalTurn(state, command.facing)
        return {
          battleSessionId: record.battleSessionId,
          battleVersion: record.battleVersion,
          facing: command.facing,
          legal: true,
          issues: [],
        }
      } catch (error) {
        return {
          battleSessionId: record.battleSessionId,
          battleVersion: record.battleVersion,
          facing: command.facing,
          legal: false,
          issues: [previewIssue(error)],
        }
      }
    },

    async commitFinalTurn(command) {
      const current = await battles.findBattleSession(command.userId, command.battleSessionId)
      if (!current) throw battleUnavailable()

      const requestFingerprint = fingerprint({
        command: 'battle.final-turn.v2',
        battleSessionId: command.battleSessionId,
        expectedBattleVersion: command.expectedBattleVersion,
        facing: command.facing,
      })

      if (current.battleVersion !== command.expectedBattleVersion) {
        const replayOrStale = await battles.commitBattleIntent({
          actorKey: command.userId,
          idempotencyKey: command.idempotencyKey,
          requestFingerprint,
          userId: command.userId,
          battleSessionId: command.battleSessionId,
          expectedBattleVersion: command.expectedBattleVersion,
          nextSnapshot: current.snapshot,
          events: [],
        })
        return {
          battleSessionId: replayOrStale.result.battleSessionId,
          battleVersion: replayOrStale.result.battleVersion,
          snapshot: projectBattleSnapshot(
            readPersistedEncounter({
              ...current,
              battleVersion: replayOrStale.result.battleVersion,
              snapshot: replayOrStale.result.snapshot,
            }),
          ),
          replayed: replayOrStale.replayed,
          invalidation: createBattleSessionChangedInvalidation({
            battleSessionId: replayOrStale.result.battleSessionId,
            battleVersion: replayOrStale.result.battleVersion,
            occurredAt: replayOrStale.result.committedAt,
            reason: 'state_changed',
          }),
        }
      }

      const state = readPersistedEncounter(current)
      assertControlledTurn(state, current.controlledCombatantIds)
      const resolved = resolveFinalTurn(state, command.facing)
      const committed = await battles.commitBattleIntent({
        actorKey: command.userId,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        userId: command.userId,
        battleSessionId: command.battleSessionId,
        expectedBattleVersion: command.expectedBattleVersion,
        nextSnapshot: resolved.state,
        events: resolved.events,
      })

      return {
        battleSessionId: committed.result.battleSessionId,
        battleVersion: committed.result.battleVersion,
        snapshot: projectBattleSnapshot(
          readPersistedEncounter({
            ...current,
            battleVersion: committed.result.battleVersion,
            snapshot: committed.result.snapshot,
          }),
        ),
        replayed: committed.replayed,
        invalidation: createBattleSessionChangedInvalidation({
          battleSessionId: committed.result.battleSessionId,
          battleVersion: committed.result.battleVersion,
          occurredAt: committed.result.committedAt,
          reason: 'state_changed',
        }),
      }
    },
  }
}
