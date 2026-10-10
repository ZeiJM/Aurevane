import 'server-only'
import type {
  CombatEffectProjection,
  CombatResolutionEvent,
  CombatActionEvaluation,
} from '@aurevane/game-core/combat/actions'
import type { CombatTerrainProjection } from '@aurevane/game-core/combat/terrain-overlays'

import type { BattleSessionRecord, BattleSessionRepository } from '@aurevane/db/battle-session'
import {
  PV1F_COMBAT_CONTENT,
  evaluatePv1fAction,
  evaluatePv1fMatureSkill,
  evaluatePv1fMovement,
  validatePv1fFinalFacing,
  readPv1fActionEconomy,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { prepareCombatAbilityCommand } from '@aurevane/game-core/combat/combat-ability-command'
import {
  combatAbilityCommandContext,
  refreezeCapturedCombatAbilityState,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import { essenceCombatSkill } from '@aurevane/game-core/combat/essence'
import {
  forecastStatDrivenAttack,
  validateStatDrivenCombatEncounterState,
  type CombatDefenseKind,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'

import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'

import { omitCombatExecutionMetadata } from './battle-live-viewer-projection'
import { battleActionResourceIssue } from './battle-action-resource-availability'
import {
  battleBuildAuthorityForCombatant,
  resolveBattleDisciplineSkillDefinition,
  resolvePinnedBattleEssenceDefinition,
  capturedBattleActionSource,
  type BattleBuildAuthoritySnapshot,
} from './battle-build-authority'

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
  /** Legacy compatibility for the hidden PV-1E cockpit while PV-1F is validated. */
  cost: number
  /** Legacy movement projection; Action Economy is the authoritative PV-1F spend. */
  movementRemainingAfter: number
}

export interface BattleActionPreview {
  kind: 'action'
  legal: boolean
  actionId: string
  actorId: string | null
  primaryCombatantId: string | null
  affectedTiles: readonly { x: number; y: number }[]
  affectedCombatantIds: readonly string[]
  projectedEffects: readonly CombatEffectProjection[]
  targetHitChances?: CombatActionEvaluation['targetHitChances']
  targetStatusResistances?: CombatActionEvaluation['targetStatusResistances']
  projectedTerrain?: readonly CombatTerrainProjection[]
  projectedEvents?: readonly CombatResolutionEvent[]
  projectedStatuses: readonly {
    statusId: string
    potencyBasisPoints?: number
    durationOwnerTurnStarts: number | null
    damageTakenMultiplierBasisPoints: number | null
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
  /** Legacy compatibility only; PV-1F uses numeric Action Economy costs. */
  spendsAction: boolean
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
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw persistenceInvalid()
  }
  try {
    const candidate = snapshot as StatDrivenCombatEncounterState
    const issues = validateStatDrivenCombatEncounterState(candidate)
    if (issues.length > 0) throw persistenceInvalid()
    return refreezeCapturedCombatAbilityState(candidate)
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

/** Public forecast probabilities only; never expose the authoritative future RNG draw. */
export function projectBattleHitChanceForecast(evaluation: CombatActionEvaluation) {
  return evaluation.targetHitChances?.map((row) => ({
    targetCombatantId: row.targetCombatantId,
    hitChanceBasisPoints: row.hitChanceBasisPoints,
  }))
}

export function projectBattleStatusResistanceForecast(evaluation: CombatActionEvaluation) {
  return evaluation.targetStatusResistances?.map((row) => ({
    targetCombatantId: row.targetCombatantId,
    resistanceChanceBasisPoints: row.resistanceChanceBasisPoints,
    eligibleEffectOrdinals: [...row.eligibleEffectOrdinals],
  }))
}

async function previewIntent(
  state: StatDrivenCombatEncounterState,
  intent: BattleIntent,
  combatContentResolver?: CombatContentResolver,
): Promise<BattleIntentPreview> {
  if (intent.kind === 'move') {
    const { prepared, movement, terrainCost, economyCost } = evaluatePv1fMovement(
      state,
      intent.path,
    )
    const economy = readPv1fActionEconomy(prepared)
    const before = economy?.current ?? 0
    const affordable = before >= economyCost
    return {
      kind: 'move',
      legal: movement.legal && affordable,
      path: movement.path,
      terrainCost,
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
      cost: movement.cost,
      movementRemainingAfter: movement.movementRemainingAfter,
    }
  }

  if (intent.kind === 'action') {
    const actorId = state.tactical.battle.currentTurn?.combatantId ?? null
    const authority = (
      state as StatDrivenCombatEncounterState & {
        buildAuthority?: BattleBuildAuthoritySnapshot
      }
    ).buildAuthority
    const build = actorId ? battleBuildAuthorityForCombatant(authority, actorId) : null
    const capturedSource = actorId
      ? capturedBattleActionSource(state, authority, actorId, intent.actionId)
      : null
    const essence =
      !capturedSource && actorId
        ? await resolvePinnedBattleEssenceDefinition(authority, actorId, combatContentResolver)
        : null
    const taggedTechnique = build?.disciplineSkills.find(
      (reference) => reference.skillId === intent.actionId,
    )
    const matureDefinition =
      !capturedSource && taggedTechnique && actorId
        ? await resolveBattleDisciplineSkillDefinition(
            authority,
            actorId,
            taggedTechnique.skillId,
            combatContentResolver,
          )
        : null
    if (!capturedSource && taggedTechnique && !matureDefinition) throw persistenceInvalid()
    const preparedState = preparePv1fTurnEconomy(state)
    const canonical =
      capturedSource && actorId
        ? prepareCombatAbilityCommand({
            state: preparedState,
            actorId,
            root: { kind: 'canonical', source: capturedSource, behaviorId: intent.behaviorId },
            manualModifiers: intent.manualModifiers,
            selection: intent.target,
            content: PV1F_COMBAT_CONTENT,
            context: combatAbilityCommandContext(preparedState, capturedSource),
          })
        : null
    const resolved = canonical
      ? {
          prepared: preparedState,
          action: canonical.action,
          evaluation: canonical.evaluation,
          cost: canonical.costs.find((row) => row.resource === 'ap')?.amount ?? 0,
        }
      : essence && essence.skill.id === intent.actionId && authority
        ? evaluatePv1fMatureSkill(
            state,
            essenceCombatSkill(essence),
            intent.target,
            authority.combatContext,
            { behaviorId: intent.behaviorId, manualModifiers: intent.manualModifiers },
          )
        : matureDefinition &&
            matureDefinition.sourceDisciplineId === taggedTechnique?.sourceDisciplineId &&
            authority
          ? evaluatePv1fMatureSkill(
              state,
              matureDefinition,
              intent.target,
              authority.combatContext,
              { behaviorId: intent.behaviorId, manualModifiers: intent.manualModifiers },
            )
          : evaluatePv1fAction(state, intent.actionId, intent.target, {
              behaviorId: intent.behaviorId,
              manualModifiers: intent.manualModifiers,
            })
    const { prepared, action, cost, evaluation } = resolved
    const economy = readPv1fActionEconomy(prepared)
    const before = economy?.current ?? 0
    const affordable = before >= cost
    const resourceIssue = battleActionResourceIssue(prepared, intent)
    const forecast =
      action.sourceType === 'basic-attack' && !action.nativeBasicAttackCommand
        ? forecastStatDrivenAttack(prepared, action, intent.target, PV1F_COMBAT_CONTENT)
        : null
    const projectedStatuses: BattleActionPreview['projectedStatuses'][number][] =
      action.effects.flatMap((effect) => {
        if (effect.type !== 'apply-status') return []
        if (effect.statusId === 'suppress') return []
        const status = PV1F_COMBAT_CONTENT.statuses.find(
          (candidate) => candidate.id === effect.statusId,
        )
        return [
          {
            statusId: effect.statusId,
            durationOwnerTurnStarts: status?.durationOwnerTurnStarts ?? null,
            damageTakenMultiplierBasisPoints: status?.damageTakenMultiplierBasisPoints ?? null,
          },
        ]
      })
    const suppressProjections = new Map(
      evaluation.projectedEffects
        .filter((effect) => effect.statusId === 'suppress')
        .map((effect) => [effect.combatantId, effect]),
    )
    for (const projection of suppressProjections.values()) {
      const receipt = evaluation.projectedEvents.find(
        (event): event is Extract<CombatResolutionEvent, { event: 'status_applied' }> =>
          event.event === 'status_applied' &&
          event.statusId === 'suppress' &&
          event.targetCombatantId === projection.combatantId,
      )
      projectedStatuses.push({
        statusId: 'suppress',
        potencyBasisPoints: projection.potencyBasisPoints ?? 2500,
        durationOwnerTurnStarts:
          projection.remainingRoundBoundaries ??
          projection.remainingOwnerTurnEnds ??
          Math.max(1, (receipt?.remainingOwnerTurnStarts ?? 3) - 1),
        damageTakenMultiplierBasisPoints: null,
      })
    }
    return {
      kind: 'action',
      legal: evaluation.legal && affordable && !resourceIssue,
      actionId: evaluation.actionId,
      actorId: evaluation.actorId,
      primaryCombatantId: evaluation.primaryCombatantId,
      affectedTiles: evaluation.affectedTiles,
      affectedCombatantIds: evaluation.affectedCombatantIds,
      projectedEffects: resourceIssue ? [] : evaluation.projectedEffects,
      targetHitChances: resourceIssue ? [] : projectBattleHitChanceForecast(evaluation),
      targetStatusResistances: resourceIssue
        ? []
        : projectBattleStatusResistanceForecast(evaluation),
      projectedStatuses,
      projectedTerrain: resourceIssue ? [] : evaluation.projectedTerrain,
      projectedEvents: resourceIssue
        ? []
        : evaluation.projectedEvents.map(omitCombatExecutionMetadata),
      mpCost: evaluation.mpCost,
      actionEconomyCost: cost,
      actionEconomyBefore: before,
      actionEconomyAfter: Math.max(0, before - cost),
      hitChanceBasisPoints:
        forecast?.hitChanceBasisPoints ??
        evaluation.targetHitChances?.find(
          (chance) => chance.targetCombatantId === evaluation.primaryCombatantId,
        )?.hitChanceBasisPoints ??
        null,
      defenseKind: forecast?.defenseKind ?? null,
      defenseRating: forecast?.defenseRating ?? null,
      mitigatedBaseDamage: forecast?.mitigatedBaseDamage ?? null,
      issues: [
        ...evaluation.issues.map((entry) => issue(entry.code, entry.message)),
        ...(resourceIssue ? [issue(resourceIssue.code, resourceIssue.message)] : []),
        ...(affordable
          ? []
          : [
              issue(
                'insufficient-action-economy',
                'Not enough Action Economy remains for that action.',
              ),
            ]),
      ],
      spendsAction: cost > 0,
    }
  }

  if (intent.kind === 'face') {
    try {
      validatePv1fFinalFacing(state, intent.facing)
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

export function createBattlePreviewService(
  battles: BattleSessionRepository,
  combatContentResolver?: CombatContentResolver,
): BattlePreviewService {
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
        preview: await previewIntent(state, command.intent, combatContentResolver),
      }
    },
  }
}
