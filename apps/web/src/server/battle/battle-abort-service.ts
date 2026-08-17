import 'server-only'

import { createHash } from 'node:crypto'

import type { BattleSessionRecord, BattleSessionRepository } from '@aurevane/db/battle-session'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { abortPracticeBattle } from '@aurevane/game-core/combat/battle-exit'
import {
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { getTacticalHallArenaFromScenarioSourceId } from '@aurevane/game-core/combat/tactical-hall-arenas'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createBattleSessionChangedInvalidation } from '@aurevane/realtime'

import type { BattleSessionProjection, BattleSessionView } from './battle-session-service'

export interface AbortPracticeBattleCommand {
  userId: string
  battleSessionId: string
  expectedBattleVersion: number
  idempotencyKey: string
}

export interface BattleAbortService {
  abortPractice(command: AbortPracticeBattleCommand): Promise<BattleSessionView>
}

function battleUnavailable(): AurevaneError {
  return new AurevaneError('FORBIDDEN', 'That battle is not available to this account.')
}

function persistenceInvalid(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The stored battle state is invalid.')
}

function abortUnavailable(message = 'This battle cannot be aborted as a practice exercise.'): AurevaneError {
  return new AurevaneError('INVALID_REQUEST', message)
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

function readPersistedEncounter(record: BattleSessionRecord): StatDrivenCombatEncounterState {
  const snapshot = record.snapshot
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw persistenceInvalid()

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

function assertPracticeAbortAllowed(
  state: StatDrivenCombatEncounterState,
  controlledCombatantIds: readonly string[],
): void {
  if (controlledCombatantIds.length === 0) throw persistenceInvalid()
  for (const combatantId of controlledCombatantIds) {
    if (!state.tactical.battle.combatants.some((candidate) => candidate.id === combatantId)) {
      throw persistenceInvalid()
    }
  }
  if (state.tactical.battle.lifecycle !== 'active' && state.tactical.battle.lifecycle !== 'pending') {
    throw abortUnavailable('Only an unfinished practice exercise can be aborted.')
  }

  const arena = state.statBridge.combatants
    .filter((profile) => profile.provenance.kind === 'scenario')
    .map((profile) => getTacticalHallArenaFromScenarioSourceId(profile.provenance.sourceId))
    .find((candidate) => candidate !== null)

  if (!arena || arena.exitPolicy !== 'ABORT_PRACTICE') throw abortUnavailable()
}

function resolvePracticeAbort(
  state: StatDrivenCombatEncounterState,
): { state: StatDrivenCombatEncounterState; events: readonly unknown[] } {
  try {
    const transition = abortPracticeBattle(state.tactical.battle)
    const encounter = createCombatEncounterState(
      { ...state.tactical, battle: transition.state },
      state.statusState,
    )
    return {
      state: reattachStatDrivenCombatBridge(encounter, state.statBridge),
      events: transition.events,
    }
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw abortUnavailable(error instanceof Error ? error.message : undefined)
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

export function createBattleAbortService(battles: BattleSessionRepository): BattleAbortService {
  return {
    async abortPractice(command) {
      const current = await battles.findBattleSession(command.userId, command.battleSessionId)
      if (!current) throw battleUnavailable()

      const requestFingerprint = fingerprint({
        command: 'battle.abort-practice.v1',
        battleSessionId: command.battleSessionId,
        expectedBattleVersion: command.expectedBattleVersion,
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
      assertPracticeAbortAllowed(state, current.controlledCombatantIds)
      const resolved = resolvePracticeAbort(state)
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
