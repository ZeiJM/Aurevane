import 'server-only'

import { createHash } from 'node:crypto'

import type { BattleEventRepository, BattleSessionRepository } from '@aurevane/db/battle-session'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError } from '@aurevane/game-core/errors'

export const GUIDED_TRAINING_CRITERIA = ['move', 'attack', 'guard', 'facing'] as const
export type GuidedTrainingCriterion = (typeof GUIDED_TRAINING_CRITERIA)[number]

export interface GuidedTrainingProgress {
  move: boolean
  attack: boolean
  guard: boolean
  facing: boolean
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

function readEncounter(snapshot: unknown): StatDrivenCombatEncounterState {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The stored training battle is invalid.')
  }
  const candidate = snapshot as StatDrivenCombatEncounterState
  const issues = validateStatDrivenCombatEncounterState(candidate)
  if (issues.length > 0) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The stored training battle is invalid.')
  }
  return candidate
}

function eventObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function readGuidedTrainingProgress(
  events: readonly { event: unknown }[],
  controlledCombatantId: string,
): GuidedTrainingProgress {
  const progress: GuidedTrainingProgress = {
    move: false,
    attack: false,
    guard: false,
    facing: false,
  }

  for (const record of events) {
    const event = eventObject(record.event)
    if (!event || typeof event.event !== 'string') continue
    const type = event.event

    if (type === 'combatant_moved' && event.combatantId === controlledCombatantId) {
      progress.move = true
      continue
    }
    if (
      type === 'combat_action_used' &&
      event.actorId === controlledCombatantId &&
      event.actionId === 'basic.attack.unarmed.basic'
    ) {
      progress.attack = true
      continue
    }
    if (
      type === 'combat_action_used' &&
      event.actorId === controlledCombatantId &&
      event.actionId === 'basic.guard'
    ) {
      progress.guard = true
      continue
    }
    if (
      (type === 'combatant_facing_changed' || type === 'final_facing_selected') &&
      event.combatantId === controlledCombatantId
    ) {
      progress.facing = true
    }
  }

  return progress
}

export function createGuidedTrainingCompletionService(
  repository: BattleSessionRepository & BattleEventRepository,
) {
  return {
    async getProgress(userId: string, battleSessionId: string): Promise<GuidedTrainingProgress> {
      const session = await repository.findBattleSession(userId, battleSessionId)
      if (!session) {
        throw new AurevaneError(
          'FORBIDDEN',
          'That training battle is not available to this account.',
        )
      }
      const controlled = session.controlledCombatantIds[0]
      if (!controlled) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'The training battle has no player actor.',
        )
      }
      const events = await repository.findBattleEvents(userId, battleSessionId, 100)
      return readGuidedTrainingProgress(events, controlled)
    },

    async complete(input: {
      userId: string
      battleSessionId: string
      idempotencyKey: string
    }): Promise<{ battleVersion: number; replayed: boolean }> {
      const session = await repository.findBattleSession(input.userId, input.battleSessionId)
      if (!session) {
        throw new AurevaneError(
          'FORBIDDEN',
          'That training battle is not available to this account.',
        )
      }
      const controlled = session.controlledCombatantIds[0]
      if (!controlled) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'The training battle has no player actor.',
        )
      }

      const state = readEncounter(session.snapshot)
      if (state.tactical.battle.lifecycle === 'completed') {
        return { battleVersion: session.battleVersion, replayed: true }
      }
      if (state.tactical.battle.lifecycle !== 'active') {
        throw new AurevaneError('INVALID_REQUEST', 'That guided exercise is no longer active.')
      }

      const events = await repository.findBattleEvents(input.userId, input.battleSessionId, 100)
      const progress = readGuidedTrainingProgress(events, controlled)
      const missing = GUIDED_TRAINING_CRITERIA.filter((criterion) => !progress[criterion])
      if (missing.length > 0) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          `Finish the remaining guided criteria before completing training: ${missing.join(', ')}.`,
        )
      }

      const nextState: StatDrivenCombatEncounterState = {
        ...state,
        tactical: {
          ...state.tactical,
          battle: {
            ...state.tactical.battle,
            lifecycle: 'completed',
            currentTurn: null,
          },
        },
      }
      const issues = validateStatDrivenCombatEncounterState(nextState)
      if (issues.length > 0) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'The completed training state is invalid.',
        )
      }

      const committed = await repository.commitBattleIntent({
        actorKey: input.userId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint({
          command: 'battle.guided-training-complete.v1',
          battleSessionId: input.battleSessionId,
          expectedBattleVersion: session.battleVersion,
          criteria: progress,
        }),
        userId: input.userId,
        battleSessionId: input.battleSessionId,
        expectedBattleVersion: session.battleVersion,
        nextSnapshot: nextState,
        events: [
          {
            event: 'guided_training_completed',
            combatantId: controlled,
            criteria: [...GUIDED_TRAINING_CRITERIA],
          },
          { event: 'battle_completed', winningTeamId: 'players', completionKind: 'training' },
        ],
      })

      return {
        battleVersion: committed.result.battleVersion,
        replayed: committed.replayed,
      }
    },
  }
}
