import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import {
  prepareAiQualityCombatant,
  resetAiMissedTurnStreak,
  timeoutAiTurn,
} from '@aurevane/game-core/combat/pvp-quality'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

import { createBattleSessionService, type BattleSessionView } from './battle-session-service'
import { createSupabaseBattleSessionRepository } from './supabase-battle-session-repository'

export interface AiTurnClockView {
  active: boolean
  turnNumber: number | null
  combatantId: string | null
  deadlineAt: string | null
  expired: boolean
}

export interface AiTurnClockTick {
  clock: AiTurnClockView
  battle: BattleSessionView | null
  timedOut: boolean
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

function parseClock(value: unknown): AiTurnClockView | null {
  if (!isObject(value) || typeof value.active !== 'boolean') return null
  if (!value.active) {
    return { active: false, turnNumber: null, combatantId: null, deadlineAt: null, expired: false }
  }
  const turnNumber = Number(value.turn_number)
  if (
    !Number.isSafeInteger(turnNumber) ||
    turnNumber < 1 ||
    typeof value.combatant_id !== 'string' ||
    typeof value.deadline_at !== 'string' ||
    typeof value.expired !== 'boolean'
  ) {
    return null
  }
  return {
    active: true,
    turnNumber,
    combatantId: value.combatant_id,
    deadlineAt: value.deadline_at,
    expired: value.expired,
  }
}

function readEncounter(value: unknown): StatDrivenCombatEncounterState {
  if (!isObject(value)) throw unavailable('The stored AI battle state is invalid.')
  const state = value as unknown as StatDrivenCombatEncounterState
  const issues = validateStatDrivenCombatEncounterState(state)
  if (issues.length > 0) throw unavailable('The stored AI battle state is invalid.')
  return state
}

function unavailable(message = 'AI battle turn services are unavailable right now.'): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

async function ensureClock(userId: string, battleSessionId: string): Promise<AiTurnClockView> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('ensure_ai_turn_clock_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
  })
  if (error) throw unavailable()
  if (!data) throw new AurevaneError('FORBIDDEN', 'That AI battle is not available to this account.')
  const clock = parseClock(data)
  if (!clock) throw unavailable('The AI battle turn clock returned invalid state.')
  return clock
}

async function previousTurnWasMissed(
  userId: string,
  battleSessionId: string,
  combatantId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_ai_timeout_context_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
    p_combatant_id: combatantId,
  })
  if (error || !isObject(data) || typeof data.previous_turn_missed !== 'boolean') {
    throw unavailable('AI battle timeout history is unavailable right now.')
  }
  return data.previous_turn_missed
}

function sessionService() {
  return createBattleSessionService({
    characters: createSupabaseCharacterRepository(),
    battles: createSupabaseBattleSessionRepository(),
  })
}

export async function tickAiTurnClock(
  userId: string,
  battleSessionId: string,
): Promise<AiTurnClockTick> {
  let clock = await ensureClock(userId, battleSessionId)
  if (!clock.active || !clock.expired || !clock.combatantId || clock.turnNumber === null) {
    return { clock, battle: null, timedOut: false }
  }

  const repository = createSupabaseBattleSessionRepository()
  const current = await repository.findBattleSession(userId, battleSessionId)
  if (!current) throw new AurevaneError('FORBIDDEN', 'That AI battle is not available to this account.')
  if (current.controlledCombatantIds.length !== 1) {
    throw unavailable('The controlled AI-battle combatant could not be resolved.')
  }

  const controlledCombatantId = current.controlledCombatantIds[0]
  let state = readEncounter(current.snapshot)
  const turn = state.tactical.battle.currentTurn
  if (
    state.tactical.battle.lifecycle !== 'active' ||
    !turn ||
    turn.combatantId !== controlledCombatantId ||
    turn.combatantId !== clock.combatantId ||
    state.tactical.battle.turnNumber !== clock.turnNumber
  ) {
    clock = await ensureClock(userId, battleSessionId)
    return { clock, battle: null, timedOut: false }
  }

  state = prepareAiQualityCombatant(state, controlledCombatantId)
  const consecutive = await previousTurnWasMissed(userId, battleSessionId, controlledCombatantId)
  if (!consecutive) state = resetAiMissedTurnStreak(state)
  const resolved = timeoutAiTurn(state)

  try {
    await repository.commitBattleIntent({
      actorKey: userId,
      idempotencyKey: randomUUID(),
      requestFingerprint: fingerprint({
        command: 'ai.timeout.v1',
        battleSessionId,
        expectedBattleVersion: current.battleVersion,
        turnNumber: clock.turnNumber,
        combatantId: clock.combatantId,
      }),
      userId,
      battleSessionId,
      expectedBattleVersion: current.battleVersion,
      nextSnapshot: resolved.state,
      events: resolved.events,
    })
  } catch (error) {
    if (!(error instanceof StaleBattleVersionError)) throw error
  }

  const battle = await sessionService().getSession(userId, battleSessionId)
  clock = await ensureClock(userId, battleSessionId)
  return { clock, battle, timedOut: true }
}
