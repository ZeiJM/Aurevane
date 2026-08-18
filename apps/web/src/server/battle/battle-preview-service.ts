import 'server-only'

import type { BattleSessionRecord, BattleSessionRepository } from '@aurevane/db/battle-session'
import {
  evaluatePv1fAction,
  evaluatePv1fMovement,
  finishPv1fTurn,
  readPv1fActionEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  forecastStatDrivenAttack,
  validateStatDrivenCombatEncounterState,
  type CombatDefenseKind,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'

export interface BattlePreviewIssue {
  code: string
  message: string
}

export interface BattleMovePreview {
  kind: 'move'
  legal: boolean
  path: readonly { x: number; y: number }[]
  terrainCost: number
  actionEconomyCost: number
  actionEconomyBefore: number
  actionEconomyAfter: number
  destination: { x: number; y: number }
  issues: readonly BattlePreviewIssue[]
}

export interface BattleActionPreview {
  kind: 'action'
  legal: boolean
  actionId: string
  actorId: string | null
  primaryCombatantId: string | null
  affectedTiles: readonly { x: number; y: number }[]
  affectedCombatantIds: readonly string[]
  projectedEffects: readonly {
    effectType: string
    combatantId: string
    before: number | string
    after: number | string
  }[]
  mpCost: number
  actionEconomyCost: number
  actionEconomyBefore: number
  actionEconomyAfter: number
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
  endsTurn: true
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
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
    throw persistenceInvalid()
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

function assertControlledTurn(
  state: StatDrivenCombatEncounterState,
  controlledCombatantIds: readonly string[],
): void {
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
      'Battle previews are available only during your character’s turn.',
    )
  }
}

function issue(code: string, message: string): BattlePreviewIssue {
  return { code, message }
}

function previewIntent(
  state: StatDrivenCombatEncounterState,
  intent: BattleIntent,
): BattleIntentPreview {
  if (intent.kind === 'move') {
    const { prepared, movement, economyCost } = evaluatePv1fMovement(state, intent.path)
    const economy = readPv1fActionEconomy(prepared)
    const before = economy?.current ?? 0
    const affordable = before >= economyCost
    return {
      kind: 'move',
      legal: movement.legal && affordable,
      path: movement.path,
      terrainCost: movement.cost,
      actionEconomyCost: economyCost,
      actionEconomyBefore: before,
      actionEconomyAfter: Math.max(0, before - economyCost),
      destination: movement.destination,
      issues: [
        ...movement.issues.map((entry) => issue(entry.code, entry.message)),
        ...(affordable
          ? []
          : [
              issue(
                'insufficient-action-economy',
                'That path costs more Action Economy than remains this turn.',
              ),
            ]),
      ],
    }
  }

  if (intent.kind === 'action') {
    const { prepared, action, cost, evaluation } = evaluatePv1fAction(
      state,
      intent.actionId,
      intent.target,
    )
    const economy = readPv1fActionEconomy(prepared)
    const before = economy?.current ?? 0
    const affordable = before >= cost
    const forecast =
      action.sourceType === 'basic-attack'
        ? forecastStatDrivenAttack(prepared, action, intent.target, {
            statuses: [
              {
                id: 'guarded',
                version: 1,
                maximumStacks: 1,
                durationOwnerTurnStarts: 2,
                damageTakenMultiplierBasisPoints: 8_500,
              },
            ],
          })
        : null
    return {
      kind: 'action',
      legal: evaluation.legal && affordable,
      actionId: evaluation.actionId,
      actorId: evaluation.actorId,
      primaryCombatantId: evaluation.primaryCombatantId,
      affectedTiles: evaluation.affectedTiles,
      affectedCombatantIds: evaluation.affectedCombatantIds,
      projectedEffects: evaluation.projectedEffects,
      mpCost: evaluation.mpCost,
      actionEconomyCost: cost,
      actionEconomyBefore: before,
      actionEconomyAfter: Math.max(0, before - cost),
      hitChanceBasisPoints: forecast?.hitChanceBasisPoints ?? null,
      defenseKind: forecast?.defenseKind ?? null,
      defenseRating: forecast?.defenseRating ?? null,
      mitigatedBaseDamage: forecast?.mitigatedBaseDamage ?? null,
      issues: [
        ...evaluation.issues.map((entry) => issue(entry.code, entry.message)),
        ...(affordable
          ? []
          : [
              issue(
                'insufficient-action-economy',
                'Not enough Action Economy remains for that action.',
              ),
            ]),
      ],
    }
  }

  if (intent.kind === 'face') {
    try {
      finishPv1fTurn(state, intent.facing)
      return { kind: 'face', legal: true, facing: intent.facing, endsTurn: true, issues: [] }
    } catch (error) {
      return {
        kind: 'face',
        legal: false,
        facing: intent.facing,
        endsTurn: true,
        issues: [
          issue(
            'final-facing-not-legal',
            error instanceof Error ? error.message : 'That facing is not legal.',
          ),
        ],
      }
    }
  }

  return {
    kind: 'end-turn',
    legal: false,
    issues: [
      issue('choose-final-facing', 'Choose North, East, South, or West to finish the turn.'),
    ],
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
