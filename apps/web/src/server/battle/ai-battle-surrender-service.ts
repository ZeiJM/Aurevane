import 'server-only'

import { createHash } from 'node:crypto'

import {
  isPvpQualityEncounter,
  surrenderPvpCombatant,
} from '@aurevane/game-core/combat/pvp-quality'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError } from '@aurevane/game-core/errors'

import { projectCommittedBattleSession, type BattleSessionView } from './battle-session-service'
import { createSupabaseBattleSessionRepository } from './supabase-battle-session-repository'

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

function unavailable(message = 'The AI battle state is unavailable right now.'): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function readEncounter(value: unknown): StatDrivenCombatEncounterState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable()
  const state = value as StatDrivenCombatEncounterState
  const issues = validateStatDrivenCombatEncounterState(state)
  if (issues.length > 0) throw unavailable('The stored AI battle state is invalid.')
  return state
}

function translateSurrenderEvents(events: readonly unknown[]): readonly unknown[] {
  return events.map((event) => {
    if (
      event &&
      typeof event === 'object' &&
      !Array.isArray(event) &&
      (event as { event?: unknown }).event === 'pvp_combatant_surrendered'
    ) {
      return { ...(event as Record<string, unknown>), event: 'ai_combatant_surrendered' }
    }
    return event
  })
}

export async function surrenderAiBattle(
  userId: string,
  battleSessionId: string,
  expectedBattleVersion: number,
  idempotencyKey: string,
): Promise<BattleSessionView> {
  const repository = createSupabaseBattleSessionRepository()
  const current = await repository.findBattleSession(userId, battleSessionId)
  if (!current) {
    throw new AurevaneError('FORBIDDEN', 'That AI battle is not available to this account.')
  }

  const requestFingerprint = fingerprint({
    command: 'ai.surrender.v1',
    battleSessionId,
    expectedBattleVersion,
  })

  const state = readEncounter(current.snapshot)
  if (isPvpQualityEncounter(state)) {
    throw new AurevaneError('INVALID_REQUEST', 'PvP battles must use the PvP surrender flow.')
  }

  if (current.battleVersion !== expectedBattleVersion) {
    const committed = await repository.commitBattleIntent({
      actorKey: userId,
      idempotencyKey,
      requestFingerprint,
      userId,
      battleSessionId,
      expectedBattleVersion,
      nextSnapshot: current.snapshot,
      events: [],
    })
    return projectCommittedBattleSession(committed)
  }

  if (state.tactical.battle.lifecycle !== 'active') {
    throw new AurevaneError('INVALID_REQUEST', 'Only an active AI battle can be surrendered.')
  }

  if (current.controlledCombatantIds.length !== 1) {
    throw unavailable('The surrendering AI-battle combatant could not be resolved.')
  }
  const controlledCombatantId = current.controlledCombatantIds[0]
  if (!controlledCombatantId) throw unavailable()

  const resolved = surrenderPvpCombatant(state, controlledCombatantId)
  const committed = await repository.commitBattleIntent({
    actorKey: userId,
    idempotencyKey,
    requestFingerprint,
    userId,
    battleSessionId,
    expectedBattleVersion,
    nextSnapshot: resolved.state,
    events: translateSurrenderEvents(resolved.events),
  })

  return projectCommittedBattleSession(committed)
}
