import 'server-only'

import { createHash } from 'node:crypto'

import type {
  BattleEventRecord,
  BattleEventRepository,
  BattleSessionRepository,
} from '@aurevane/db/battle-session'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { getTacticalHallRecordFromScenarioSourceId } from '@aurevane/game-core/combat/tactical-hall-records'
import { AurevaneError } from '@aurevane/game-core/errors'

import { collectBattleEventHistory } from './battle-log-service'

export const GUIDED_TRAINING_CRITERIA = ['move', 'attack', 'guard', 'facing'] as const
export type GuidedTrainingCriterion = (typeof GUIDED_TRAINING_CRITERIA)[number]

export interface GuidedTrainingProgress {
  move: boolean
  attack: boolean
  guard: boolean
  facing: boolean
}

type GuidedTrainingBattleStatus = {
  lifecycle: StatDrivenCombatEncounterState['tactical']['battle']['lifecycle']
  combatants: readonly { id: string; hp: number }[]
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

function assertGuidedFundamentals(state: StatDrivenCombatEncounterState): void {
  const scenario = state.statBridge.combatants.find(
    (profile) => profile.provenance.kind === 'scenario',
  )
  const record = scenario
    ? getTacticalHallRecordFromScenarioSourceId(scenario.provenance.sourceId)
    : null
  if (record?.id !== 'guided-fundamentals') {
    throw new AurevaneError(
      'FORBIDDEN',
      'Guided training completion is available only inside the Guided Fundamentals exercise.',
    )
  }
}

function eventObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function isControlledTurnTimeout(
  event: Record<string, unknown>,
  controlledCombatantId: string,
): boolean {
  return (
    (event.event === 'ai_turn_timed_out' || event.event === 'pvp_turn_timed_out') &&
    event.combatantId === controlledCombatantId
  )
}

function hasGuidedTrainingCompletion(
  events: readonly Pick<BattleEventRecord, 'event'>[],
  controlledCombatantId: string,
): boolean {
  return events.some((record) => {
    const event = eventObject(record.event)
    return (
      event?.event === 'guided_training_completed' && event.combatantId === controlledCombatantId
    )
  })
}

export function readGuidedTrainingCompletionDisposition(
  battle: GuidedTrainingBattleStatus,
  events: readonly Pick<BattleEventRecord, 'event'>[],
  controlledCombatantId: string,
): 'active' | 'replayed' {
  const controlledCombatant = battle.combatants.find(
    (combatant) => combatant.id === controlledCombatantId,
  )
  if (!controlledCombatant) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The training battle has no player actor.')
  }

  if (controlledCombatant.hp <= 0) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Guided training is lost when your combatant is defeated.',
    )
  }

  if (battle.lifecycle === 'completed') {
    if (hasGuidedTrainingCompletion(events, controlledCombatantId)) {
      return 'replayed'
    }
    throw new AurevaneError(
      'INVALID_REQUEST',
      'That guided exercise ended without a training victory.',
    )
  }

  if (battle.lifecycle !== 'active') {
    throw new AurevaneError('INVALID_REQUEST', 'That guided exercise is no longer active.')
  }

  return 'active'
}

export function readGuidedTrainingProgress(
  events: readonly Pick<BattleEventRecord, 'battleVersion' | 'event'>[],
  controlledCombatantId: string,
): GuidedTrainingProgress {
  const progress: GuidedTrainingProgress = {
    move: false,
    attack: false,
    guard: false,
    facing: false,
  }
  const timedOutBattleVersions = new Set<number>()

  for (const record of events) {
    const event = eventObject(record.event)
    if (event && isControlledTurnTimeout(event, controlledCombatantId)) {
      timedOutBattleVersions.add(record.battleVersion)
    }
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
      event.combatantId === controlledCombatantId &&
      !timedOutBattleVersions.has(record.battleVersion)
    ) {
      progress.facing = true
    }
  }

  return progress
}

export async function collectGuidedTrainingEventHistory(
  repository: BattleEventRepository,
  userId: string,
  battleSessionId: string,
): Promise<BattleEventRecord[]> {
  // These criteria describe accomplishments, not current-state conditions. Once the player has
  // legitimately performed one, later rounds must never erase it merely because its source event
  // aged out of a rolling event window.
  return collectBattleEventHistory((pageSize, before) =>
    before
      ? repository.findBattleEvents(userId, battleSessionId, pageSize, before)
      : repository.findBattleEvents(userId, battleSessionId, pageSize),
  )
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
      const state = readEncounter(session.snapshot)
      assertGuidedFundamentals(state)
      const controlled = session.controlledCombatantIds[0]
      if (!controlled) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'The training battle has no player actor.',
        )
      }
      const events = await collectGuidedTrainingEventHistory(repository, userId, battleSessionId)
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
      assertGuidedFundamentals(state)
      const events = await collectGuidedTrainingEventHistory(
        repository,
        input.userId,
        input.battleSessionId,
      )
      const disposition = readGuidedTrainingCompletionDisposition(
        state.tactical.battle,
        events,
        controlled,
      )
      if (disposition === 'replayed') {
        return { battleVersion: session.battleVersion, replayed: true }
      }

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
