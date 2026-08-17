import 'server-only'

import type { BattleSessionRecord, BattleSessionRepository } from '@aurevane/db/battle-session'
import {
  P2_3_COMBAT_CONTENT,
  P2_3_GUARD_ACTION,
  P2_3_UNARMED_ATTACK_PROFILE,
  createBasicAttackDefinition,
  endCombatTurn,
  evaluateCombatAction,
  type CombatActionDefinition,
  type CombatActionEvaluation,
  type CombatEffectProjection,
} from '@aurevane/game-core/combat/actions'
import {
  evaluateCurrentMovementPath,
  selectCurrentFinalFacing,
  type GridPosition,
  type MovementPathIssue,
} from '@aurevane/game-core/combat/board'
import {
  forecastStatDrivenAttack,
  validateStatDrivenCombatEncounterState,
  type CombatDefenseKind,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'

const P2_5_BASIC_ATTACK = createBasicAttackDefinition(P2_3_UNARMED_ATTACK_PROFILE)
const P2_5_ACTIONS: readonly CombatActionDefinition[] = [P2_5_BASIC_ATTACK, P2_3_GUARD_ACTION]

export interface BattlePreviewIssue {
  code: string
  message: string
}

export interface BattleMovePreview {
  kind: 'move'
  legal: boolean
  path: readonly GridPosition[]
  cost: number
  destination: GridPosition
  movementRemainingBefore: number
  movementRemainingAfter: number
  issues: readonly BattlePreviewIssue[]
}

export interface BattleActionPreview {
  kind: 'action'
  legal: boolean
  actionId: string
  actorId: string | null
  primaryCombatantId: string | null
  affectedTiles: readonly GridPosition[]
  affectedCombatantIds: readonly string[]
  projectedEffects: readonly CombatEffectProjection[]
  mpCost: number
  spendsAction: boolean
  hitChanceBasisPoints: number | null
  defenseKind: CombatDefenseKind | null
  defenseRating: number | null
  mitigatedBaseDamage: number | null
  issues: readonly BattlePreviewIssue[]
}

export interface BattleFacingPreview {
  kind: 'face'
  legal: boolean
  facing: 'north' | 'east' | 'south' | 'west'
  issues: readonly BattlePreviewIssue[]
}

export interface BattleEndTurnPreview {
  kind: 'end-turn'
  legal: boolean
  issues: readonly BattlePreviewIssue[]
}

export type BattleIntentPreview =
  BattleMovePreview | BattleActionPreview | BattleFacingPreview | BattleEndTurnPreview

export interface BattlePreviewView {
  battleSessionId: string
  battleVersion: number
  preview: BattleIntentPreview
}

export interface PreviewBattleIntentCommand {
  userId: string
  battleSessionId: string
  expectedBattleVersion: number
  intent: BattleIntent
}

export interface BattlePreviewService {
  previewIntent(command: PreviewBattleIntentCommand): Promise<BattlePreviewView>
}

function battleUnavailable(): AurevaneError {
  return new AurevaneError('FORBIDDEN', 'That battle is not available to this account.')
}

function persistenceInvalid(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The stored battle state is invalid.')
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
  if (
    controlledCombatantIds.length === 0 ||
    new Set(controlledCombatantIds).size !== controlledCombatantIds.length
  ) {
    throw persistenceInvalid()
  }

  for (const combatantId of controlledCombatantIds) {
    if (!state.tactical.battle.combatants.some((candidate) => candidate.id === combatantId)) {
      throw persistenceInvalid()
    }
  }

  const turn = state.tactical.battle.currentTurn
  if (state.tactical.battle.lifecycle !== 'active' || !turn) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'That battle does not currently accept a player command.',
    )
  }
  if (!controlledCombatantIds.includes(turn.combatantId)) {
    throw new AurevaneError(
      'FORBIDDEN',
      'Battle previews are only available during a player-controlled turn.',
    )
  }
}

function findAction(actionId: string): CombatActionDefinition {
  const action = P2_5_ACTIONS.find((candidate) => candidate.id === actionId)
  if (!action) {
    throw new AurevaneError('INVALID_REQUEST', 'That action is not available in this battle.')
  }
  return action
}

function movementIssues(issues: readonly MovementPathIssue[]): BattlePreviewIssue[] {
  return issues.map((issue) => ({ code: issue.code, message: issue.message }))
}

function actionIssues(evaluation: CombatActionEvaluation): BattlePreviewIssue[] {
  return evaluation.issues.map((issue) => ({ code: issue.code, message: issue.message }))
}

function commandIssue(error: unknown): BattlePreviewIssue[] {
  return [
    {
      code: 'command-not-legal',
      message:
        error instanceof Error ? error.message : 'That command is not legal in the current state.',
    },
  ]
}

function previewIntent(
  state: StatDrivenCombatEncounterState,
  intent: BattleIntent,
): BattleIntentPreview {
  if (intent.kind === 'move') {
    const preview = evaluateCurrentMovementPath(state.tactical, intent.path)
    return {
      kind: 'move',
      legal: preview.legal,
      path: preview.path,
      cost: preview.cost,
      destination: preview.destination,
      movementRemainingBefore: preview.movementRemainingBefore,
      movementRemainingAfter: preview.movementRemainingAfter,
      issues: movementIssues(preview.issues),
    }
  }

  if (intent.kind === 'action') {
    const action = findAction(intent.actionId)
    if (action.sourceType === 'basic-attack') {
      const forecast = forecastStatDrivenAttack(state, action, intent.target, P2_3_COMBAT_CONTENT)
      return {
        kind: 'action',
        legal: forecast.evaluation.legal,
        actionId: forecast.evaluation.actionId,
        actorId: forecast.evaluation.actorId,
        primaryCombatantId: forecast.evaluation.primaryCombatantId,
        affectedTiles: forecast.evaluation.affectedTiles,
        affectedCombatantIds: forecast.evaluation.affectedCombatantIds,
        projectedEffects: forecast.evaluation.projectedEffects,
        mpCost: forecast.evaluation.mpCost,
        spendsAction: forecast.evaluation.spendsAction,
        hitChanceBasisPoints: forecast.hitChanceBasisPoints,
        defenseKind: forecast.defenseKind,
        defenseRating: forecast.defenseRating,
        mitigatedBaseDamage: forecast.mitigatedBaseDamage,
        issues: actionIssues(forecast.evaluation),
      }
    }

    const evaluation = evaluateCombatAction(state, action, intent.target, P2_3_COMBAT_CONTENT)
    return {
      kind: 'action',
      legal: evaluation.legal,
      actionId: evaluation.actionId,
      actorId: evaluation.actorId,
      primaryCombatantId: evaluation.primaryCombatantId,
      affectedTiles: evaluation.affectedTiles,
      affectedCombatantIds: evaluation.affectedCombatantIds,
      projectedEffects: evaluation.projectedEffects,
      mpCost: evaluation.mpCost,
      spendsAction: evaluation.spendsAction,
      hitChanceBasisPoints: null,
      defenseKind: null,
      defenseRating: null,
      mitigatedBaseDamage: null,
      issues: actionIssues(evaluation),
    }
  }

  if (intent.kind === 'face') {
    try {
      selectCurrentFinalFacing(state.tactical, intent.facing)
      return { kind: 'face', legal: true, facing: intent.facing, issues: [] }
    } catch (error) {
      return { kind: 'face', legal: false, facing: intent.facing, issues: commandIssue(error) }
    }
  }

  try {
    endCombatTurn(state, P2_3_COMBAT_CONTENT)
    return { kind: 'end-turn', legal: true, issues: [] }
  } catch (error) {
    return { kind: 'end-turn', legal: false, issues: commandIssue(error) }
  }
}

export function createBattlePreviewService(battles: BattleSessionRepository): BattlePreviewService {
  return {
    async previewIntent(command) {
      const record = await battles.findBattleSession(command.userId, command.battleSessionId)
      if (!record) throw battleUnavailable()
      if (record.battleVersion !== command.expectedBattleVersion) {
        throw new StaleBattleVersionError(record.battleVersion)
      }

      const state = readPersistedEncounter(record)
      assertControlledTurn(state, record.controlledCombatantIds)

      return {
        battleSessionId: record.battleSessionId,
        battleVersion: record.battleVersion,
        preview: previewIntent(state, command.intent),
      }
    },
  }
}
