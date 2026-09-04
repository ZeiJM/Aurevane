import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import type { BattleSessionRepository } from '@aurevane/db/battle-session'
import {
  executeBuildAwareRecruitAiAction,
  chooseBuildAwareRecruitAiDecision,
} from '@aurevane/game-core/combat/recruit-ai-build'
import {
  getRecruitAiProfile,
  type RecruitAiDecision,
  type RecruitAiDifficulty,
  type RecruitAiIntent,
} from '@aurevane/game-core/combat/recruit-ai'
import { executePv1fMovement, finishPv1fTurn } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'
import {
  createBattleSessionChangedInvalidation,
  type BattleSessionChangedInvalidation,
} from '@aurevane/realtime'

const MAX_RECRUIT_DECISIONS_PER_REQUEST = 16

type ProjectedBattleState = Omit<StatDrivenCombatEncounterState['tactical']['battle'], 'rng'>
type ProjectedTacticalState = Omit<StatDrivenCombatEncounterState['tactical'], 'battle'> & {
  battle: ProjectedBattleState
}
type RecruitBattleProjection = Omit<StatDrivenCombatEncounterState, 'tactical'> & {
  tactical: ProjectedTacticalState
}

export interface RecruitTurnView {
  battleSessionId: string
  battleVersion: number
  snapshot: RecruitBattleProjection
  decisions: readonly {
    combatantId: string
    reason: RecruitAiDecision['reason']
    utility: number
  }[]
  invalidation: BattleSessionChangedInvalidation
}

export interface RunRecruitTurnCommand {
  userId: string
  battleSessionId: string
  expectedBattleVersion: number
}

export interface RecruitTieBreakSeedInput {
  battleId: string
  round: number
  turnNumber: number
  battleVersion: number
  step: number
  combatantId: string
}

export interface BattleRecruitAiService {
  runTurn(command: RunRecruitTurnCommand): Promise<RecruitTurnView>
}

function battleUnavailable(): AurevaneError {
  return new AurevaneError('FORBIDDEN', 'That battle is not available to this account.')
}

function persistenceInvalid(message = 'The stored battle state is invalid.'): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function readPersistedEncounter(snapshot: unknown): StatDrivenCombatEncounterState {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw persistenceInvalid()
  }
  try {
    const candidate = snapshot as StatDrivenCombatEncounterState
    const issues = validateStatDrivenCombatEncounterState(candidate)
    if (issues.length > 0) throw persistenceInvalid()
    return candidate
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw persistenceInvalid()
  }
}

function projectBattleSnapshot(state: StatDrivenCombatEncounterState): RecruitBattleProjection {
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

function resolveRecruitIntent(
  state: StatDrivenCombatEncounterState,
  intent: RecruitAiIntent,
): { state: StatDrivenCombatEncounterState; events: readonly unknown[] } {
  try {
    if (intent.kind === 'move') return executePv1fMovement(state, intent.path)
    if (intent.kind === 'action') {
      return executeBuildAwareRecruitAiAction(state, intent.actionId, intent.target)
    }
    if (intent.kind === 'face') return finishPv1fTurn(state, intent.facing)

    const activeId = state.tactical.battle.currentTurn?.combatantId
    const placement = activeId
      ? state.tactical.placements.find((candidate) => candidate.combatantId === activeId)
      : null
    if (!placement) throw new Error('Recruit has no committed facing.')
    return finishPv1fTurn(state, placement.facing)
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw persistenceInvalid('Recruit AI produced a command rejected by shared combat legality.')
  }
}

function recruitDifficultyForActor(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): RecruitAiDifficulty {
  const profile = state.statBridge.combatants.find(
    (candidate) => candidate.combatantId === combatantId,
  )
  const sourceId = profile?.provenance.sourceId ?? ''
  if (sourceId.endsWith(':easy')) return 'easy'
  if (sourceId.endsWith(':high')) return 'high'
  return 'standard'
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

export function deriveRecruitTieBreakSeed(input: RecruitTieBreakSeedInput): number {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        domain: 'aurevane.recruit-ai.tie-break.v2',
        battleId: input.battleId,
        round: input.round,
        turnNumber: input.turnNumber,
        battleVersion: input.battleVersion,
        step: input.step,
        combatantId: input.combatantId,
      }),
    )
    .digest()
  return digest.readInt32BE(0)
}

function decisionEvent(decision: RecruitAiDecision, combatantId: string) {
  return {
    event: 'recruit_ai_decision',
    combatantId,
    profileId: decision.profileId,
    profileVersion: decision.profileVersion,
    rulesVersion: decision.rulesVersion,
    reason: decision.reason,
    utility: decision.utility,
    candidateCount: decision.candidateCount,
  }
}

export function createBattleRecruitAiService(
  battles: BattleSessionRepository,
): BattleRecruitAiService {
  return {
    async runTurn(command) {
      const initial = await battles.findBattleSession(command.userId, command.battleSessionId)
      if (!initial) throw battleUnavailable()
      if (initial.battleVersion !== command.expectedBattleVersion) {
        throw new StaleBattleVersionError(initial.battleVersion)
      }

      let state = readPersistedEncounter(initial.snapshot)
      const controlledIds = [...initial.controlledCombatantIds]
      if (controlledIds.length === 0 || new Set(controlledIds).size !== controlledIds.length) {
        throw persistenceInvalid()
      }

      const initialTurn = state.tactical.battle.currentTurn
      if (
        state.tactical.battle.lifecycle !== 'active' ||
        !initialTurn ||
        controlledIds.includes(initialTurn.combatantId)
      ) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Recruit AI can run only while an opponent-controlled turn is active.',
        )
      }

      let battleVersion = initial.battleVersion
      let committedAt = initial.updatedAt
      const decisions: Array<RecruitTurnView['decisions'][number]> = []

      for (let step = 0; step < MAX_RECRUIT_DECISIONS_PER_REQUEST; step += 1) {
        const battle = state.tactical.battle
        const turn = battle.currentTurn
        if (
          battle.lifecycle !== 'active' ||
          turn === null ||
          controlledIds.includes(turn.combatantId)
        ) {
          return {
            battleSessionId: initial.battleSessionId,
            battleVersion,
            snapshot: projectBattleSnapshot(state),
            decisions,
            invalidation: createBattleSessionChangedInvalidation({
              battleSessionId: initial.battleSessionId,
              battleVersion,
              occurredAt: committedAt,
              reason: 'state_changed',
            }),
          }
        }

        const difficulty = recruitDifficultyForActor(state, turn.combatantId)
        const decision = chooseBuildAwareRecruitAiDecision({
          state,
          profile: getRecruitAiProfile(difficulty),
          tieBreakSeed: deriveRecruitTieBreakSeed({
            battleId: battle.battleId,
            round: battle.round,
            turnNumber: battle.turnNumber,
            battleVersion,
            step,
            combatantId: turn.combatantId,
          }),
        })
        const resolved = resolveRecruitIntent(state, decision.intent)
        const event = decisionEvent(decision, turn.combatantId)
        const requestFingerprint = fingerprint({
          command: 'battle.recruit-ai.v2',
          battleSessionId: initial.battleSessionId,
          expectedBattleVersion: battleVersion,
          difficulty,
          decision: {
            intent: decision.intent,
            reason: decision.reason,
            profileId: decision.profileId,
            profileVersion: decision.profileVersion,
            rulesVersion: decision.rulesVersion,
          },
        })
        const committed = await battles.commitBattleIntent({
          actorKey: command.userId,
          idempotencyKey: randomUUID(),
          requestFingerprint,
          userId: command.userId,
          battleSessionId: initial.battleSessionId,
          expectedBattleVersion: battleVersion,
          nextSnapshot: resolved.state,
          events: [event, ...resolved.events],
        })

        battleVersion = committed.result.battleVersion
        committedAt = committed.result.committedAt
        state = readPersistedEncounter(committed.result.snapshot)
        decisions.push({
          combatantId: turn.combatantId,
          reason: decision.reason,
          utility: decision.utility,
        })
      }

      throw persistenceInvalid(
        `Recruit AI exceeded the bounded ${MAX_RECRUIT_DECISIONS_PER_REQUEST}-decision turn budget.`,
      )
    },
  }
}
