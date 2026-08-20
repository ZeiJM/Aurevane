import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import {
  isPvpQualityEncounter,
  resetPvpMissedTurnStreak,
  surrenderPvpCombatant,
  timeoutPvpTurn,
} from '@aurevane/game-core/combat/pvp-quality'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

import { createBattleSessionService, type BattleSessionView } from './battle-session-service'
import { getPvpBattleMetadata } from './pvp-lobby-service'
import { createSupabaseBattleSessionRepository } from './supabase-battle-session-repository'

export interface PvpTurnClockView {
  active: boolean
  turnNumber: number | null
  combatantId: string | null
  deadlineAt: string | null
  expired: boolean
}

export interface PvpTurnClockTick {
  clock: PvpTurnClockView
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

function parseClock(value: unknown): PvpTurnClockView | null {
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
  if (!isObject(value)) throw unavailable('The stored PvP battle state is invalid.')
  const state = value as unknown as StatDrivenCombatEncounterState
  const issues = validateStatDrivenCombatEncounterState(state)
  if (issues.length > 0) throw unavailable('The stored PvP battle state is invalid.')
  if (!isPvpQualityEncounter(state)) {
    throw unavailable('This PvP battle predates the current turn-clock rules.')
  }
  return state
}

function unavailable(message = 'PvP battle services are unavailable right now.'): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

async function ensureClock(userId: string, battleSessionId: string): Promise<PvpTurnClockView> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('ensure_pvp_turn_clock_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
  })
  if (error) throw unavailable()
  if (!data) throw new AurevaneError('FORBIDDEN', 'That PvP battle is not available to this account.')
  const clock = parseClock(data)
  if (!clock) throw unavailable('The PvP turn clock returned invalid state.')
  return clock
}

async function previousTurnWasMissed(
  userId: string,
  battleSessionId: string,
  combatantId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_pvp_timeout_context_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
    p_combatant_id: combatantId,
  })
  if (error || !isObject(data) || typeof data.previous_turn_missed !== 'boolean') {
    throw unavailable('PvP timeout history is unavailable right now.')
  }
  return data.previous_turn_missed
}

function sessionService() {
  return createBattleSessionService({
    characters: createSupabaseCharacterRepository(),
    battles: createSupabaseBattleSessionRepository(),
  })
}

export async function tickPvpTurnClock(
  userId: string,
  battleSessionId: string,
): Promise<PvpTurnClockTick> {
  let clock = await ensureClock(userId, battleSessionId)
  if (!clock.active || !clock.expired || !clock.combatantId || clock.turnNumber === null) {
    return { clock, battle: null, timedOut: false }
  }

  const repository = createSupabaseBattleSessionRepository()
  const current = await repository.findBattleSession(userId, battleSessionId)
  if (!current) throw new AurevaneError('FORBIDDEN', 'That PvP battle is not available to this account.')
  let state = readEncounter(current.snapshot)
  const turn = state.tactical.battle.currentTurn
  if (
    state.tactical.battle.lifecycle !== 'active' ||
    !turn ||
    turn.combatantId !== clock.combatantId ||
    state.tactical.battle.turnNumber !== clock.turnNumber
  ) {
    clock = await ensureClock(userId, battleSessionId)
    return { clock, battle: null, timedOut: false }
  }

  const consecutive = await previousTurnWasMissed(userId, battleSessionId, turn.combatantId)
  if (!consecutive) state = resetPvpMissedTurnStreak(state)
  const resolved = timeoutPvpTurn(state)

  try {
    await repository.commitBattleIntent({
      actorKey: userId,
      idempotencyKey: randomUUID(),
      requestFingerprint: fingerprint({
        command: 'pvp.timeout.v1',
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

export async function surrenderPvpBattle(
  userId: string,
  battleSessionId: string,
): Promise<BattleSessionView> {
  const metadata = await getPvpBattleMetadata(userId, battleSessionId)
  if (!metadata) {
    throw new AurevaneError('INVALID_REQUEST', 'Only a PvP battle can be surrendered.')
  }

  const repository = createSupabaseBattleSessionRepository()
  const current = await repository.findBattleSession(userId, battleSessionId)
  if (!current) throw new AurevaneError('FORBIDDEN', 'That PvP battle is not available to this account.')
  const state = readEncounter(current.snapshot)
  const controlled = current.controlledCombatantIds[0]
  if (!controlled || current.controlledCombatantIds.length !== 1) {
    throw unavailable('The surrendering combatant could not be resolved.')
  }

  const resolved = surrenderPvpCombatant(state, controlled)
  if (resolved.events.length === 0) return sessionService().getSession(userId, battleSessionId)

  try {
    await repository.commitBattleIntent({
      actorKey: userId,
      idempotencyKey: randomUUID(),
      requestFingerprint: fingerprint({
        command: 'pvp.surrender.v1',
        battleSessionId,
        expectedBattleVersion: current.battleVersion,
        combatantId: controlled,
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

  return sessionService().getSession(userId, battleSessionId)
}
