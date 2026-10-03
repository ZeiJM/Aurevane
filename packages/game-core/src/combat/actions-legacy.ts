import { applyCommittedAbsorbRecovery } from './combat-absorb-recovery'
import { applyCommittedReflect } from './combat-reflect'
import { filterBlockedCovertApplication } from './covert-sensory-revealed'
import { validateSummonProfileDefinition } from './summon-content'
import type { CombatSkillCopiedEvent } from './combat-skill-copy'
import {
  spawnCombatSummon,
  type SpawnCombatSummonInput,
  type CombatSummonEvent,
} from './combat-summons'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'
import {
  COMBAT_EFFECT_TIMING_TAGS,
  combatEffectTimingMode,
  combatEffectTimingTag,
  parseCombatEffectTimingPolicy,
  pendingCombatStatusRows,
  type CombatEffectTimingPolicy,
} from './combat-effect-timing'
import {
  applyCombatStatusCopies,
  attachCombatStatusCopyProvenance,
  planCombatStatusCopies,
  validateCombatStatusCopyAction,
  type CombatStatusCopyEffect,
} from './combat-status-copy'
import {
  assertValidCombatAccuracyStatusState,
  collectCombatStatusIdentityIssues,
  compareCombatStatusInstances,
  validateCombatAccuracyStatusDefinition,
} from './combat-accuracy-status'
import type { CombatSkillAccuracyResolvedEvent } from './combat-skill-accuracy'
import {
  COMBAT_CRITICAL_DAMAGE_BASIS_POINTS,
  type CombatCriticalResolvedEvent,
} from './combat-critical'
import {
  absorbDirectDamageWithBarrier,
  currentBarrierAmount,
  grantBarrier,
  validateBarrierEffect,
  validateBarrierState,
} from './combat-barrier'
import {
  validateRecoveryEffect,
  validateOngoingRecoveryState,
  replaceRecoverySchedule,
  clearDefeatedRecovery,
} from './combat-recovery'
import {
  CURRENT_BURN_BACKLASH_DAMAGE,
  advanceCurrentBleedEndTurn,
  advanceCurrentBurnEndTurn,
  advanceCurrentPoisonEndTurn,
  advanceCurrentPoisonMovement,
  applyCurrentBleedState,
  applyCurrentBurnState,
  applyCurrentPoisonState,
  currentBleedStacks,
  currentBurnInstance,
  currentPoisonEndTurnDamage,
  currentPoisonInstance,
  hasCurrentBleed,
  hasCurrentBurn,
  hasCurrentPoison,
  removeCurrentBleedState,
  removeCurrentBurnState,
  removeCurrentPoisonState,
  validateCombatDotState,
  validateCurrentBleedEffect,
  validateCurrentBurnEffect,
  validateCurrentPoisonEffect,
} from './combat-dots'
import {
  normalizeCombatEffectState,
  validateCombatTemporarySkillState,
  type CombatEffectState,
  type CombatTemporarySkillGrant,
} from './combat-effect-state'
import {
  validateCombatEffectInstanceProvenance,
  createCombatActionProvenance,
  createCombatTriggerGuard,
  type CombatActionProvenance,
  type CombatEffectInstanceProvenance,
} from './combat-kernel-types'
import {
  hasGameplayTag,
  statusIdsForGameplayTag,
  validateGameplayTag,
  validateGameplayActionMetadata,
  type GameplayTag,
  type CombatElement,
} from './gameplay-tags'
import {
  terrainOverlayAt,
  setTerrainOverlay,
  expireTerrainOverlays,
  validateTerrainOverlays,
  type CombatTerrainOverlay,
  type CombatTerrainProjection,
  type CombatTerrainEvent,
} from './terrain-overlays'
import { mitigateDamageByDefense } from './damage-mitigation'
import { combatLevelDamageModifierBasisPoints } from './combat-level-scaling'
import type { SkillNarrationTemplate } from './battle-narration'
import {
  conditionalDamageMultiplier,
  validateDamageModifiers,
  type CombatDamageModifier,
} from './damage-modifiers'
import {
  applySkillCooldown,
  readSkillCooldown,
  validateSkillCooldownDefinition,
  type SkillCooldownDefinition,
  type SkillCooldownEvent,
} from './skill-cooldowns'
import {
  defeatCurrentCombatant,
  endTurn,
  spendAction,
  type BattleCombatant,
  type BattleState,
} from './battle-state'
import {
  classifyFacingRelation,
  createTacticalBattleState,
  validateTacticalBattleState,
  type CombatPlacement,
  type CombatTile,
  type GridPosition,
  type TacticalBattleEvent,
  type TacticalBattleState,
} from './board'

export const COMBAT_ENCOUNTER_SCHEMA_VERSION = 1 as const
export const COMBAT_BASIS_POINTS = 10_000 as const

export type CombatActionSourceType =
  'basic-attack' | 'basic-action' | 'discipline-skill' | 'scenario' | 'test'
export type CombatTargetKind = 'self' | 'unit' | 'ground-tile' | 'empty-tile'
export type CombatTargetTeamPolicy = 'self' | 'ally' | 'enemy' | 'any'
export type CombatFriendlyFirePolicy =
  'enemies-only' | 'allies-only' | 'all-units' | 'all-except-actor'
export type CombatEffectRecipient = 'actor' | 'primary-unit' | 'affected-units'

export type CombatTargetShape =
  { kind: 'single' } | { kind: 'circle'; radius: number } | { kind: 'line'; length: number }

export interface CombatTargetSpec {
  kind: CombatTargetKind
  teamPolicy: CombatTargetTeamPolicy
  shape: CombatTargetShape
  minimumRange: number
  maximumRange: number
  requiresLineOfSight: boolean
  maximumElevationDifference: number | null
  friendlyFire: CombatFriendlyFirePolicy
}

export interface CombatActionCost {
  spendsAction: boolean
  mp: number
}

export type CombatUseRequirement =
  | { kind: 'actor-status-present'; statusId: string }
  | { kind: 'actor-status-absent'; statusId: string }
  | { kind: 'target-status-present'; statusId: string }
  | { kind: 'actor-hp-at-most'; basisPoints: number }
  | { kind: 'actor-tag-present' | 'actor-tag-absent' | 'target-tag-present'; tag: GameplayTag }

export interface FacingDamageModifiers {
  front: number
  side: number
  rear: number
}

export interface CombatSkillCopyEffect {
  type: 'copy'
  recipient: 'primary-unit'
}

export type CombatEffectDefinition =
  | CombatStatusCopyEffect
  | CombatSkillCopyEffect
  | {
      type: 'damage'
      recipient: CombatEffectRecipient
      amount: number
      defenseKind?: 'armor' | 'ward'
      piercing?: boolean
      element?: CombatElement
      facingModifiersBasisPoints?: FacingDamageModifiers
    }
  | { type: 'create-terrain'; recipient: 'affected-tiles'; terrain: 'frozen' }
  | {
      type: 'displace'
      recipient: Exclude<CombatEffectRecipient, 'actor'>
      direction?: 'push' | 'pull'
      distance: number
    }
  | { type: 'poison'; recipient: CombatEffectRecipient; curseCopyable?: boolean }
  | { type: 'burn'; recipient: CombatEffectRecipient; curseCopyable?: boolean }
  | {
      type: 'bleed'
      recipient: CombatEffectRecipient
      damagePerTick: number
      ticks: number
      curseCopyable?: boolean
    }
  | { type: 'barrier-change'; recipient: CombatEffectRecipient; amount: number }
  | {
      type: 'sensory'
      recipient: 'primary-unit'
      revealedDurationOwnerTurnStarts: number
    }
  | { type: 'healing'; recipient: CombatEffectRecipient; amount: number; ticks?: number }
  | { type: 'return-to-turn-start'; recipient: 'actor' }
  | { type: 'remove-status'; recipient: CombatEffectRecipient; statusIds: readonly string[] }
  | {
      type: 'resource-change'
      recipient: CombatEffectRecipient
      resource: 'mp'
      delta: number
      ticks?: number
    }
  | {
      type: 'apply-status'
      recipient: CombatEffectRecipient
      statusId: string
      stacks: number
    }

export interface CombatEffectOrigin {
  family: 'skill' | 'essence' | 'resonance' | 'basic'
  contentId: string
  contentVersion: number
}

export interface CombatActionDefinition {
  effectOrigins?: readonly (CombatEffectOrigin | undefined)[]
  effectTimingTags?: readonly (string | undefined)[]
  id: string
  version: number
  sourceType: CombatActionSourceType
  tags: readonly string[]
  target: CombatTargetSpec
  cost: CombatActionCost
  requirements: readonly CombatUseRequirement[]
  cooldown?: SkillCooldownDefinition
  narration?: SkillNarrationTemplate
  effects: readonly CombatEffectDefinition[]
}

export interface CombatAttackProfile {
  id: string
  version: number
  damage: number
  minimumRange: number
  maximumRange: number
  requiresLineOfSight: boolean
  maximumElevationDifference: number | null
  facingModifiersBasisPoints: FacingDamageModifiers
}

export interface CombatStatusDefinition {
  id: string
  version: number
  maximumStacks: number
  durationOwnerTurnStarts: number
  damageTakenMultiplierBasisPoints: number
  /** Additional bounded modifiers; omitted by immutable legacy status definitions. */
  damageModifiers?: readonly CombatDamageModifier[]
  gameplayTags?: readonly GameplayTag[]
  endOfTurn?: { type: 'damage' | 'healing'; amount: number }
  movement?: { blocked?: boolean; additionalApPerTile?: number }
  /** Consumed at the next round boundary; never adds or skips turns. */
  nextRoundInitiative?: number
}

export interface CombatContentCatalog {
  statuses: readonly CombatStatusDefinition[]
}

export interface CombatStatusInstance {
  durationScope?: 'battle' | 'instant' | 'until-spent' | 'until-removed' | 'rounds'

  skipCurrentOwnerTurnEnd?: boolean
  timingState?: 'pending' | 'active'
  activationRound?: number
  remainingOwnerTurnEnds?: number
  remainingRoundBoundaries?: number

  /** Only current accuracy Mark definitions use independent source/target identities. */
  sourceScopedMark?: true
  statusId: string
  statusVersion: number
  stacks: number
  remainingOwnerTurnStarts: number
  sourceCombatantId: string
  /** Optional per-application authored magnitude; 100 = 1 percentage point. */
  potencyBasisPoints?: number
  provenance?: CombatEffectInstanceProvenance
}

export interface CombatantStatusState {
  combatantId: string
  statuses: readonly CombatStatusInstance[]
}

export interface CombatSourceCommandVisibility {
  kind: 'team-only'
  teamId: string
}

/** Pin the original cast privacy before its effects can reveal or expire Covert. */
export function combatSourceCommandVisibility(
  state: CombatEncounterState,
  actorId: string,
): CombatSourceCommandVisibility | undefined {
  if (
    !state.statusState
      .find((row) => row.combatantId === actorId)
      ?.statuses.some((status) => status.statusId === 'covert')
  )
    return undefined
  return { kind: 'team-only', teamId: getCombatant(state.tactical.battle, actorId).teamId }
}

export interface PendingCombatEffect {
  copyProvenance?: CombatActionProvenance
  sourceCommandVisibility?: CombatSourceCommandVisibility
  copySource?: {
    beneficialPersistentEffects?: true
    combatantId: string
    statuses: readonly CombatStatusInstance[]
    effectState: CombatEffectState
  }

  timingTag?: string
  effectOrigin?: CombatEffectOrigin
  criticalRecipientIds?: readonly string[]
  actorId: string
  actionId: string
  effect: CombatEffectDefinition
  recipientIds: readonly string[]
  affectedTiles: readonly GridPosition[]
  activationRound: number
  content: CombatContentCatalog
  turnOrigin?: CombatEncounterState['turnOrigin']
}

export interface CombatEncounterState {
  /** Version 1 copies beneficial active tags; omitted historical battles grant a temporary Skill. */
  copyPolicyVersion?: 1
  pendingSkillGrants?: readonly {
    grant: CombatTemporarySkillGrant
    activationRound: number
    sourceCommandVisibility?: CombatSourceCommandVisibility
  }[]
  pendingSummons?: readonly {
    input: SpawnCombatSummonInput
    activationRound: number
    sourceCommandVisibility?: CombatSourceCommandVisibility
  }[]
  effectTimingPolicy?: CombatEffectTimingPolicy
  pendingEffects?: readonly PendingCombatEffect[]

  schemaVersion: typeof COMBAT_ENCOUNTER_SCHEMA_VERSION
  tactical: TacticalBattleState
  statBridge?: {
    rulesVersion?: number
    combatants: readonly {
      combatantId: string
      armor: number
      ward: number
      level?: number
      criticalChance?: number
    }[]
  }
  statusState: readonly CombatantStatusState[]
  effectState?: CombatEffectState
  terrainOverlays?: readonly CombatTerrainOverlay[]
  turnOrigin?: { combatantId: string; turnNumber: number; position: GridPosition }
}

export type CombatTargetSelection =
  | { kind: 'self' }
  | { kind: 'unit'; combatantId: string }
  | { kind: 'tile'; position: GridPosition }

export type CombatActionIssueCode =
  | 'battle-not-active'
  | 'action-already-spent'
  | 'insufficient-mp'
  | 'cooldown-active'
  | 'invalid-target-kind'
  | 'target-not-found'
  | 'target-defeated'
  | 'target-invisible'
  | 'target-team-not-allowed'
  | 'target-tile-occupied'
  | 'target-out-of-range'
  | 'target-elevation-invalid'
  | 'line-of-sight-blocked'
  | 'shape-invalid'
  | 'requirement-not-met'
  | 'effect-target-missing'
  | 'self-damage-deferred'

export interface CombatActionIssue {
  code: CombatActionIssueCode
  message: string
}

export interface CombatEffectProjection {
  /** Forecast metadata describes scheduled application, never a committed result. */
  activationRound?: number
  statusId?: string
  durationScope?: CombatStatusInstance['durationScope']
  remainingOwnerTurnEnds?: number
  remainingRoundBoundaries?: number
  effectType: CombatEffectDefinition['type'] | 'summon'
  combatantId: string
  before: number | string
  after: number | string
}

export interface CombatActionEvaluation {
  legal: boolean
  actionId: string
  actorId: string | null
  primaryPosition: GridPosition | null
  primaryCombatantId: string | null
  affectedTiles: readonly GridPosition[]
  affectedCombatantIds: readonly string[]
  projectedEffects: readonly CombatEffectProjection[]
  projectedTerrain: readonly CombatTerrainProjection[]
  projectedEvents: readonly CombatResolutionEvent[]
  mpCost: number
  spendsAction: boolean
  issues: readonly CombatActionIssue[]
}

export type CombatResolutionEvent = (
  | {
      event: 'persistent_effect_applied'
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string
      statusId: 'poison' | 'burn' | 'bleed'
    }
  | {
      event: 'effect_pending'
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string | null
      effectTag: string
      activationRound: number
    }
  | CombatSkillAccuracyResolvedEvent
  | CombatCriticalResolvedEvent
  | CombatSkillCopiedEvent
  | CombatSummonEvent
  | TacticalBattleEvent
  | CombatTerrainEvent
  | {
      event: 'combatant_displaced'
      direction?: 'push' | 'pull'
      distance?: number
      actionId: string
      sourceCombatantId: string
      combatantId: string
      from: GridPosition
      to: GridPosition
    }
  | {
      event: 'displacement_failed'
      direction?: 'push' | 'pull'
      actionId: string
      sourceCombatantId: string
      combatantId: string
      reason: DisplacementFailureReason
      position: GridPosition
    }
  | SkillCooldownEvent
  | { event: 'combat_action_used'; actionId: string; actorId: string }
  | { event: 'mp_spent'; combatantId: string; amount: number; remaining: number }
  | {
      event: 'damage_applied'
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string
      amount: number
      hpBefore: number
      hpAfter: number
    }
  | {
      event: 'barrier_changed'
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string
      amount: number
      before: number
      after: number
    }
  | {
      event: 'barrier_absorbed'
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string
      amount: number
      before: number
      after: number
    }
  | {
      event: 'healing_applied'
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string
      amount: number
      hpBefore: number
      hpAfter: number
    }
  | {
      event: 'resource_changed'
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string
      resource: 'mp'
      delta: number
      before: number
      after: number
    }
  | {
      event: 'status_applied'
      expiryBoundary?: 'owner-turn-end'
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string
      statusId: string
      stacks: number
      remainingOwnerTurnStarts: number
      refreshed: boolean
      stacked: boolean
    }
  | {
      event: 'recovery_scheduled'
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string
      resource: 'hp' | 'mp'
      amountPerTick: number
      remainingFutureTicks: number
    }
  | { event: 'status_expired'; combatantId: string; statusId: string; sourceCombatantId?: string }
  | {
      event: 'status_removed'
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string
      statusId: string
    }
  | {
      event: 'combatant_rewound'
      actionId: string
      combatantId: string
      from: GridPosition
      to: GridPosition
    }
  | { event: 'combatant_waited'; combatantId: string }
  | { event: 'battle_completed'; winningTeamId: string | null }
) & {
  effectOrigin?: CombatEffectOrigin
  sourceCommandVisibility?: CombatSourceCommandVisibility
  effectActivationRound?: number
}

export type DisplacementFailureReason =
  | 'status-restricted'
  | 'out-of-bounds'
  | 'blocked-terrain'
  | 'occupied-tile'
  | 'elevation-step-too-high'
  | 'direction-undefined'
  | 'target-defeated'

export interface CombatResolutionTransition {
  state: CombatEncounterState
  events: readonly CombatResolutionEvent[]
}

export interface CombatEncounterIssue {
  field: string
  message: string
}

export const P2_3_GUARDED_STATUS: CombatStatusDefinition = {
  id: 'guarded',
  version: 1,
  maximumStacks: 3,
  durationOwnerTurnStarts: 1,
  damageTakenMultiplierBasisPoints: 8_000,
}

export const P2_3_COMBAT_CONTENT: CombatContentCatalog = {
  statuses: [P2_3_GUARDED_STATUS],
}

export const P2_3_GUARD_ACTION: CombatActionDefinition = {
  id: 'basic.guard',
  version: 1,
  sourceType: 'basic-action',
  tags: ['basic', 'defensive'],
  target: {
    kind: 'self',
    teamPolicy: 'self',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 0,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'allies-only',
  },
  cost: { spendsAction: true, mp: 0 },
  requirements: [],
  effects: [{ type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 }],
}

export const P2_3_UNARMED_ATTACK_PROFILE: CombatAttackProfile = {
  id: 'unarmed.basic',
  version: 1,
  damage: 16,
  minimumRange: 1,
  maximumRange: 1,
  requiresLineOfSight: false,
  maximumElevationDifference: 1,
  facingModifiersBasisPoints: {
    front: 10_000,
    side: 11_000,
    rear: 12_500,
  },
}

export function createBasicAttackDefinition(profile: CombatAttackProfile): CombatActionDefinition {
  validateAttackProfile(profile)

  return {
    id: `basic.attack.${profile.id}`,
    version: profile.version,
    sourceType: 'basic-attack',
    tags: ['attack', 'basic'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: profile.minimumRange,
      maximumRange: profile.maximumRange,
      requiresLineOfSight: profile.requiresLineOfSight,
      maximumElevationDifference: profile.maximumElevationDifference,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: true, mp: 0 },
    requirements: [],
    effects: [
      {
        type: 'damage',
        recipient: 'primary-unit',
        amount: profile.damage,
        facingModifiersBasisPoints: profile.facingModifiersBasisPoints,
      },
    ],
  }
}

export function createCombatEncounterState(
  tactical: TacticalBattleState,
  statusState: readonly CombatantStatusState[] = [],
): CombatEncounterState {
  const combatantIds = new Set(tactical.battle.combatants.map((combatant) => combatant.id))
  const suppliedRows = new Set<string>()

  for (const row of statusState) {
    if (!combatantIds.has(row.combatantId)) {
      throw new Error(`Unknown status-state combatant ${row.combatantId}.`)
    }
    if (suppliedRows.has(row.combatantId)) {
      throw new Error(`Duplicate status-state row for combatant ${row.combatantId}.`)
    }
    suppliedRows.add(row.combatantId)
  }

  const byCombatantId = new Map(statusState.map((row) => [row.combatantId, row.statuses]))
  const normalizedStatusState = tactical.battle.combatants
    .map((combatant) => ({
      combatantId: combatant.id,
      statuses: [...(byCombatantId.get(combatant.id) ?? [])]
        .map((status) => ({ ...status }))
        .sort(compareCombatStatusInstances),
    }))
    .sort((left, right) => compareStableString(left.combatantId, right.combatantId))

  const state: CombatEncounterState = {
    schemaVersion: COMBAT_ENCOUNTER_SCHEMA_VERSION,
    tactical,
    statusState: normalizedStatusState,
  }

  assertValidCombatEncounterState(state)
  return state
}

export function evaluateCombatAction(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  content: CombatContentCatalog,
): CombatActionEvaluation {
  assertValidCombatEncounterState(state)
  validateCombatContentCatalog(content)
  assertValidCombatAccuracyStatusState(state, content)
  validateCombatActionDefinition(action, content)

  const issues: CombatActionIssue[] = []
  const battle = state.tactical.battle
  const turn = battle.currentTurn
  const actorId = battle.lifecycle === 'active' && turn ? turn.combatantId : null

  if (!actorId || !turn) {
    issues.push({ code: 'battle-not-active', message: 'Combat action requires an active turn.' })
    return emptyEvaluation(action, actorId, issues)
  }

  if (action.cost.spendsAction && turn.actionState !== 'ready') {
    issues.push({
      code: 'action-already-spent',
      message: 'The actor has already spent its Action this turn.',
    })
  }

  const actor = getCombatant(battle, actorId)
  if (action.cooldown) {
    const cooldown = readSkillCooldown(actor, action.cooldown)
    if (cooldown.active) {
      issues.push({
        code: 'cooldown-active',
        message: `That Skill is cooling down (${cooldown.ticksRemaining} owner-turn tick${cooldown.ticksRemaining === 1 ? '' : 's'} remain).`,
      })
    }
  }
  if (actor.mp < action.cost.mp) {
    issues.push({ code: 'insufficient-mp', message: 'The actor does not have enough MP.' })
  }

  const target = resolvePrimaryTarget(state, actorId, action.target, selection, content, issues)
  if (target.position) {
    collectSpatialTargetIssues(state, actorId, action.target, target.position, issues)
  }
  collectRequirementIssues(state, actorId, target.combatantId, action.requirements, content, issues)
  if (action.effects.some((effect) => effect.type === 'return-to-turn-start')) {
    const origin = state.turnOrigin
    const placement = getPlacement(state.tactical, actorId)
    const tile =
      origin && state.tactical.tiles.find((tile) => samePosition(tile.position, origin.position))
    if (
      !origin ||
      origin.combatantId !== actorId ||
      origin.turnNumber !== battle.turnNumber ||
      samePosition(origin.position, placement.position) ||
      !tile ||
      state.tactical.terrains.find((terrain) => terrain.id === tile.terrainId)?.traversalCost ==
        null ||
      state.tactical.placements.some(
        (unit) => unit.combatantId !== actorId && samePosition(unit.position, origin.position),
      )
    ) {
      issues.push({
        code: 'requirement-not-met',
        message:
          'Rewind Step requires a vacant, passable tile where you started this turn, after moving away.',
      })
    }
    if (
      getStatusRow(state, actorId).statuses.some(
        (status) =>
          getStatusDefinition(content, status.statusId, status.statusVersion).movement?.blocked,
      )
    )
      issues.push({ code: 'requirement-not-met', message: 'Root prevents Rewind Step.' })
  }

  const affectedTiles =
    target.position && issues.length === 0
      ? resolveTargetShapeTiles(
          state.tactical,
          getPlacement(state.tactical, actorId).position,
          target.position,
          action.target.shape,
        )
      : []

  if (target.position && issues.length === 0 && affectedTiles.length === 0) {
    issues.push({
      code: 'shape-invalid',
      message: 'The target shape resolves to no legal board tiles.',
    })
  }

  const affectedCombatantIds =
    issues.length === 0
      ? resolveAffectedCombatants(state, actorId, target.combatantId, action.target, affectedTiles)
      : []

  if (issues.length === 0) {
    collectSelfDamageIssues(
      action.effects,
      actorId,
      target.combatantId,
      affectedCombatantIds,
      issues,
    )
  }

  if (issues.length === 0) {
    collectEffectRecipientIssues(
      action.effects,
      target.combatantId,
      affectedCombatantIds,
      issues,
      (action.target.kind === 'ground-tile' || action.target.kind === 'empty-tile') &&
        action.effects.some(
          (effect) =>
            effect.type === 'create-terrain' ||
            (effect.type === 'damage' && effect.element !== undefined),
        ),
    )
  }

  const copyEffect = action.effects[0]
  if (issues.length === 0 && copyEffect?.type === 'copy-statuses' && target.combatantId) {
    if (
      target.combatantId === actorId ||
      (copyEffect.beneficialEffects === true && state.copyPolicyVersion !== 1) ||
      (() => {
        const plan = planCombatStatusCopies(state, actorId, target.combatantId, copyEffect, content)
        const empty =
          plan.copies.length === 0 &&
          !plan.poison &&
          !plan.burn &&
          plan.bleed.length === 0 &&
          plan.barriers.length === 0 &&
          plan.recovery.length === 0
        return empty && copyEffect.allowNoEligibleEffects !== true
      })()
    ) {
      issues.push({
        code: 'requirement-not-met',
        message: 'Status copying requires eligible active statuses on a different combatant.',
      })
    }
  }

  let projectedEffects: CombatEffectProjection[] = []
  let projectedTerrain: CombatTerrainProjection[] = []
  let projectedEvents: readonly CombatResolutionEvent[] = []
  if (issues.length === 0) {
    const projectionState =
      action.cost.mp > 0
        ? withUpdatedCombatant(state, actorId, {
            ...actor,
            mp: actor.mp - action.cost.mp,
          })
        : state
    const projection = resolveActionEffects(
      projectionState,
      actorId,
      target.combatantId,
      affectedCombatantIds,
      affectedTiles,
      action,
      content,
    )
    projectedEffects = projection.projections
    projectedEvents = projection.events
    projectedTerrain = projection.terrain
  }

  return {
    legal: issues.length === 0,
    actionId: action.id,
    actorId,
    primaryPosition: target.position ? { ...target.position } : null,
    primaryCombatantId: target.combatantId,
    affectedTiles,
    affectedCombatantIds,
    projectedEffects,
    projectedTerrain,
    projectedEvents,
    mpCost: action.cost.mp,
    spendsAction: action.cost.spendsAction,
    issues,
  }
}

export function shouldApplyCurrentBurnBacklash(
  state: CombatEncounterState,
  actorId: string,
  action: CombatActionDefinition,
): boolean {
  return (
    hasCurrentBurn(state, actorId) &&
    (action.sourceType === 'basic-attack' ||
      action.effects.some((effect) => effect.type === 'damage' && effect.amount > 0))
  )
}

export function applyCurrentBurnBacklash(
  state: CombatEncounterState,
  actorId: string,
): CombatResolutionTransition {
  const actor = getCombatant(state.tactical.battle, actorId)
  if (actor.hp <= 0) return { state, events: [] }

  const hpAfter = Math.max(0, actor.hp - CURRENT_BURN_BACKLASH_DAMAGE)
  const damageEvent: CombatResolutionEvent = {
    event: 'damage_applied',
    actionId: 'status.burn.backlash.current.v1',
    sourceCombatantId: actorId,
    targetCombatantId: actorId,
    amount: actor.hp - hpAfter,
    hpBefore: actor.hp,
    hpAfter,
  }
  if (hpAfter === 0) {
    const defeated = defeatCurrentCombatant(state.tactical.battle, actorId)
    return {
      state: withBattle(state, defeated.state),
      events: [damageEvent, ...defeated.events],
    }
  }
  return {
    state: withUpdatedCombatant(state, actorId, { ...actor, hp: hpAfter }),
    events: [damageEvent],
  }
}

export function executeCombatAction(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  content: CombatContentCatalog,
  resolveCommittedReactions?: (
    transition: CombatResolutionTransition,
  ) => CombatResolutionTransition,
  missedCombatantIds?: ReadonlySet<string>,
  criticalEffectOrdinalsByTarget?: ReadonlyMap<string, ReadonlySet<number>>,
): CombatResolutionTransition {
  const evaluation = evaluateCombatAction(state, action, selection, content)
  if (!evaluation.legal || !evaluation.actorId) {
    const issue = evaluation.issues[0]
    throw new Error(
      issue
        ? `Illegal combat action: ${issue.code}: ${issue.message}`
        : 'Illegal combat action without a validation reason.',
    )
  }

  const actorId = evaluation.actorId
  const burnBacklashApplies = shouldApplyCurrentBurnBacklash(state, actorId, action)
  let nextState = state
  let events: CombatResolutionEvent[] = []

  if (action.cost.spendsAction) {
    const spent = spendAction(nextState.tactical.battle)
    nextState = withBattle(nextState, spent.state)
    events.push(...spent.events)
  }

  if (action.cost.mp > 0) {
    const actor = getCombatant(nextState.tactical.battle, actorId)
    nextState = withUpdatedCombatant(nextState, actorId, {
      ...actor,
      mp: actor.mp - action.cost.mp,
    })
    events.push({
      event: 'mp_spent',
      combatantId: actorId,
      amount: action.cost.mp,
      remaining: actor.mp - action.cost.mp,
    })
  }

  events.push({ event: 'combat_action_used', actionId: action.id, actorId })

  const applied = resolveActionEffects(
    nextState,
    actorId,
    evaluation.primaryCombatantId,
    evaluation.affectedCombatantIds,
    evaluation.affectedTiles,
    action,
    content,
    missedCombatantIds,
    criticalEffectOrdinalsByTarget,
  )
  nextState = applied.state
  events.push(...applied.events)

  if (action.cooldown) {
    const cooldown = applySkillCooldown(
      getCombatant(nextState.tactical.battle, actorId),
      action.cooldown,
      { actionId: action.id, definitionVersion: action.version },
    )
    nextState = withUpdatedCombatant(nextState, actorId, cooldown.combatant)
    events.push(...cooldown.events)
  }

  if (burnBacklashApplies) {
    const backlash = applyCurrentBurnBacklash(nextState, actorId)
    nextState = backlash.state
    events.push(...backlash.events)
  }

  // Engine-owned reaction seam: committed effects first, terminal verdict last.
  // Omitted by historical four-argument callers; never populated by authored scripts.
  if (resolveCommittedReactions) {
    const reacted = resolveCommittedReactions({ state: nextState, events })
    nextState = reacted.state
    events = [...reacted.events]
  }

  const completion = completeBattleIfResolved(nextState)
  nextState = completion.state
  events.push(...completion.events)

  assertValidCombatEncounterState(nextState)
  return { state: nextState, events }
}

export function waitCurrentTurn(
  state: CombatEncounterState,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  assertValidCombatEncounterState(state)
  validateCombatContentCatalog(content)
  assertValidCombatAccuracyStatusState(state, content)

  const turn = state.tactical.battle.currentTurn
  if (state.tactical.battle.lifecycle !== 'active' || !turn) {
    throw new Error('Wait requires an active combat turn.')
  }

  const actorId = turn.combatantId
  const ended = endCombatTurn(state, content)
  return {
    state: ended.state,
    events: [{ event: 'combatant_waited', combatantId: actorId }, ...ended.events],
  }
}

/** Encounter upkeep for a reaction knockout; the defeated actor receives no extra periodic tick. */
export function defeatCombatActionActor(
  state: CombatEncounterState,
  actorId: string,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  let defeated = defeatCurrentCombatant(
    state.tactical.battle,
    actorId,
    collectNextRoundInitiativeModifiers(state, content),
  )
  const summonBoundary = preparePendingSummonsForRound(state, defeated.state.round)
  if (summonBoundary.state !== state)
    defeated = defeatCurrentCombatant(
      summonBoundary.state.tactical.battle,
      actorId,
      collectNextRoundInitiativeModifiers(summonBoundary.state, content),
    )
  const boundary = applyCombatRoundBoundary(
    withBattle(summonBoundary.state, defeated.state),
    state.tactical.battle.round,
    content,
  )
  const successorId = boundary.state.tactical.battle.currentTurn?.combatantId
  const successor = successorId
    ? expireOwnerTurnStartStatuses(boundary.state, successorId, content)
    : { state: boundary.state, events: [] }
  return {
    state: successor.state,
    events: [...defeated.events, ...summonBoundary.events, ...boundary.events, ...successor.events],
  }
}

function collectNextRoundInitiativeModifiers(
  state: CombatEncounterState,
  content: CombatContentCatalog,
): NonNullable<BattleState['roundInitiativeModifiers']> {
  return state.statusState.flatMap((row) => {
    const amount = Math.max(
      -40,
      Math.min(
        40,
        row.statuses.reduce(
          (sum, status) =>
            sum +
            (getStatusDefinition(content, status.statusId, status.statusVersion)
              .nextRoundInitiative ?? 0),
          0,
        ) +
          (state.pendingEffects ?? [])
            .filter(
              (pending) =>
                pending.activationRound === state.tactical.battle.round + 1 &&
                pending.recipientIds.includes(row.combatantId) &&
                pending.effect.type === 'apply-status',
            )
            .reduce(
              (sum, pending) =>
                sum +
                (pending.content.statuses.find(
                  (definition) =>
                    definition.id === (pending.effect as { statusId: string }).statusId,
                )?.nextRoundInitiative ?? 0),
              0,
            ),
      ),
    )
    return amount === 0 ? [] : [{ combatantId: row.combatantId, amount }]
  })
}

function applyCombatRoundBoundary(
  state: CombatEncounterState,
  previousRound: number,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  if (state.tactical.battle.round === previousRound) return { state, events: [] }
  let nextState = state
  const events: CombatResolutionEvent[] = []
  const expiredTerrain = expireTerrainOverlays(nextState)
  nextState = expiredTerrain.state
  events.push(...expiredTerrain.events)
  // Consume scheduled tempo once. The committed order remains frozen for the full round.
  for (const row of nextState.statusState) {
    const consumed = row.statuses.filter(
      (status) =>
        getStatusDefinition(content, status.statusId, status.statusVersion).nextRoundInitiative !==
        undefined,
    )
    nextState = removeStatuses(
      nextState,
      row.combatantId,
      consumed.map((status) => status.statusId),
    )
    events.push(
      ...consumed.map((status) => ({
        event: 'status_expired' as const,
        combatantId: row.combatantId,
        statusId: status.statusId,
      })),
    )
  }
  if (nextState.pendingSkillGrants?.length) {
    const readyGrants = nextState.pendingSkillGrants.filter(
      (row) => row.activationRound <= nextState.tactical.battle.round,
    )
    nextState = {
      ...nextState,
      pendingSkillGrants: nextState.pendingSkillGrants.filter(
        (row) => row.activationRound > nextState.tactical.battle.round,
      ),
    }
    const normalizedEffects = normalizeCombatEffectState(nextState.effectState)
    const effectState = {
      ...normalizedEffects,
      temporarySkills: [...normalizedEffects.temporarySkills],
    }
    for (const pending of readyGrants) {
      if (getCombatant(nextState.tactical.battle, pending.grant.combatantId).hp <= 0) continue
      if (
        !effectState.temporarySkills.some(
          (grant) =>
            grant.combatantId === pending.grant.combatantId &&
            grant.skillId === pending.grant.skillId &&
            grant.contentVersion === pending.grant.contentVersion,
        )
      )
        effectState.temporarySkills.push({ ...pending.grant })
      events.push({
        event: 'temporary_skill_copied',
        ...pending.grant,
        ...(pending.sourceCommandVisibility
          ? { sourceCommandVisibility: pending.sourceCommandVisibility }
          : {}),
      })
    }
    nextState = { ...nextState, effectState }
  }
  const ready = (nextState.pendingEffects ?? []).filter(
    (effect) => effect.activationRound <= nextState.tactical.battle.round,
  )
  if (nextState.pendingEffects)
    nextState = {
      ...nextState,
      pendingEffects: nextState.pendingEffects.filter(
        (effect) => effect.activationRound > nextState.tactical.battle.round,
      ),
    }
  for (const pending of ready) {
    const action: CombatActionDefinition = {
      id: pending.actionId,
      version: 1,
      sourceType: 'test',
      tags: [],
      cost: { spendsAction: false, mp: 0 },
      requirements: [],
      target: {
        kind: 'unit',
        teamPolicy: 'any',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 0,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'all-units',
      },
      effectOrigins: [pending.effectOrigin],
      effectTimingTags: [pending.timingTag],
      effects: [pending.effect],
    }
    const recipients = pending.recipientIds.filter(
      (id) => getCombatant(nextState.tactical.battle, id).hp > 0,
    )
    if (pending.effect.type !== 'create-terrain' && !recipients.length) continue
    if (pending.effect.type === 'return-to-turn-start') {
      const destination = pending.turnOrigin?.position
      if (
        !destination ||
        nextState.tactical.placements.some(
          (row) => row.combatantId !== pending.actorId && samePosition(row.position, destination),
        )
      )
        continue
    }
    const policy = nextState.effectTimingPolicy
    const sourceBefore = pending.copySource
      ? captureStatusCopySource(
          nextState,
          pending.copySource.combatantId,
          pending.copySource.beneficialPersistentEffects === true,
        )
      : null
    const resolutionState = pending.copySource
      ? withStatusCopySource(nextState, pending.copySource)
      : nextState
    const applied = resolveActionEffects(
      { ...resolutionState, ...(pending.turnOrigin ? { turnOrigin: pending.turnOrigin } : {}) },
      pending.actorId,
      recipients[0] ?? null,
      recipients,
      pending.affectedTiles,
      action,
      pending.content,
      undefined,
      new Map((pending.criticalRecipientIds ?? []).map((id) => [id, new Set([0])])),
      true,
    )
    const filtered = filterBlockedCovertApplication({
      before: resolutionState,
      after: applied.state,
      events: applied.events,
    })
    const lineaged =
      pending.copyProvenance && pending.effect.type === 'copy-statuses' && recipients[0]
        ? attachCombatStatusCopyProvenance(
            resolutionState,
            filtered.state,
            pending.actorId,
            recipients[0],
            pending.effect,
            pending.content,
            {
              provenance: pending.copyProvenance,
              triggerGuard: createCombatTriggerGuard({
                triggerChainId: pending.copyProvenance.triggerChainId,
              }),
            },
          )
        : filtered.state
    const command = { sourceCombatantId: pending.actorId, actionId: pending.actionId }
    const recovered = applyCommittedAbsorbRecovery(
      lineaged,
      filtered.events as CombatResolutionEvent[],
      pending.content,
      command,
    )
    const reflected = applyCommittedReflect(
      recovered.state,
      filtered.events as CombatResolutionEvent[],
      pending.content,
      command,
      undefined,
      true,
    )
    const resolved = { state: reflected.state, events: [...recovered.events, ...reflected.events] }
    nextState = {
      ...(sourceBefore ? withStatusCopySource(resolved.state, sourceBefore) : resolved.state),
      effectTimingPolicy: policy,
      turnOrigin: nextState.turnOrigin,
    }
    events.push(
      ...resolved.events.map((event) => ({
        ...event,
        effectActivationRound: state.tactical.battle.round,
        ...(pending.sourceCommandVisibility
          ? { sourceCommandVisibility: pending.sourceCommandVisibility }
          : {}),
      })),
    )
    if (
      pending.effect.type === 'apply-status' &&
      pending.content.statuses.find(
        (definition) => definition.id === (pending.effect as { statusId: string }).statusId,
      )?.nextRoundInitiative !== undefined
    ) {
      for (const recipientId of pending.recipientIds) {
        nextState = removeStatuses(nextState, recipientId, [pending.effect.statusId])
        events.push({
          event: 'status_expired',
          combatantId: recipientId,
          statusId: pending.effect.statusId,
        })
      }
    }
  }
  return { state: nextState, events }
}

export function endCombatTurn(
  state: CombatEncounterState,
  content: CombatContentCatalog,
  outgoingDefeatedAtTurnEnd = false,
): CombatResolutionTransition {
  assertValidCombatEncounterStateForTurnEnd(state, outgoingDefeatedAtTurnEnd)
  validateCombatContentCatalog(content)
  assertValidCombatAccuracyStatusState(state, content)

  if (state.tactical.battle.lifecycle !== 'active') {
    throw new Error('End Turn requires an active battle.')
  }

  const roundModifiers = collectNextRoundInitiativeModifiers(state, content)
  const outgoingId = state.tactical.battle.currentTurn!.combatantId
  const outgoing = getCombatant(state.tactical.battle, outgoingId)
  // Predict the existing deterministic ticks for selection only. They are committed below.
  // A last actor moved to first by tempo must not receive a turn after a lethal tick.
  const legacyOutgoingHpAfterTicks = getStatusRow(state, outgoingId).statuses.reduce(
    (hp, status) => {
      const periodic = getStatusDefinition(content, status.statusId, status.statusVersion).endOfTurn
      if (!periodic || hp <= 0) return hp
      const amount = periodic.amount * status.stacks
      return periodic.type === 'damage'
        ? Math.max(0, hp - amount)
        : Math.min(outgoing.maxHp, hp + incomingHealingAmount(state, outgoingId, amount, content))
    },
    outgoing.hp,
  )
  const outgoingHpAfterTicks = Math.max(
    0,
    legacyOutgoingHpAfterTicks -
      (currentPoisonInstance(state, outgoingId)?.skipCurrentOwnerTurnEnd
        ? 0
        : currentPoisonEndTurnDamage(state, outgoingId)) -
      advanceCurrentBleedEndTurn(state, outgoingId).stacks.reduce(
        (sum, row) => sum + row.damagePerTick,
        0,
      ) -
      advanceCurrentBurnEndTurn(state, outgoingId).damage,
  )
  let ended = endTurn(
    state.tactical.battle,
    roundModifiers,
    outgoingDefeatedAtTurnEnd || outgoingHpAfterTicks === 0,
  )
  const summonBoundary = preparePendingSummonsForRound(state, ended.state.round)
  if (summonBoundary.state !== state)
    ended = endTurn(
      summonBoundary.state.tactical.battle,
      roundModifiers,
      outgoingDefeatedAtTurnEnd || outgoingHpAfterTicks === 0,
    )
  let nextState = withBattle(summonBoundary.state, ended.state)
  const events: CombatResolutionEvent[] = [...ended.events, ...summonBoundary.events]
  // Resolve the outgoing unit's periodic effects after advancing initiative. This permits
  // lethal ticks without ever persisting a defeated combatant as the current actor.
  const periodic = resolveEndOfTurnStatuses(nextState, outgoingId, content)
  nextState = periodic.state
  events.push(...periodic.events)
  const currentDots = resolveCurrentEndOfTurnDots(nextState, outgoingId, content)
  nextState = currentDots.state
  events.push(...currentDots.events)
  const recovery = resolveEndOfTurnRecovery(nextState, outgoingId, content)
  nextState = recovery.state
  events.push(...recovery.events)
  const ownerExpiry = expireOwnerTurnEndStatuses(nextState, outgoingId)
  nextState = ownerExpiry.state
  events.push(...ownerExpiry.events)
  const boundary = applyCombatRoundBoundary(nextState, state.tactical.battle.round, content)
  nextState = boundary.state
  events.push(...boundary.events)
  const completed = completeBattleIfResolved(nextState)
  nextState = completed.state
  events.push(...completed.events)
  const nextActorId = nextState.tactical.battle.currentTurn?.combatantId

  if (nextActorId) {
    const expiration = expireOwnerTurnStartStatuses(nextState, nextActorId, content)
    nextState = expiration.state
    events.push(...expiration.events)
  }

  return { state: nextState, events }
}

export function resolveTargetShapeTiles(
  tactical: TacticalBattleState,
  origin: GridPosition,
  selected: GridPosition,
  shape: CombatTargetShape,
): readonly GridPosition[] {
  assertGridPosition(origin, 'origin')
  assertGridPosition(selected, 'selected')

  if (shape.kind === 'single') {
    return isWithinBoard(tactical, selected) ? [{ ...selected }] : []
  }

  if (shape.kind === 'circle') {
    assertNonNegativeSafeInteger(shape.radius, 'circle radius')
    const radiusSquared = BigInt(shape.radius) * BigInt(shape.radius)

    return tactical.tiles
      .filter((tile) => {
        const dx = BigInt(tile.position.x - selected.x)
        const dy = BigInt(tile.position.y - selected.y)
        return dx * dx + dy * dy <= radiusSquared
      })
      .map((tile) => ({ ...tile.position }))
  }

  assertPositiveSafeInteger(shape.length, 'line length')
  const dx = selected.x - origin.x
  const dy = selected.y - origin.y
  if ((dx === 0) === (dy === 0)) {
    return []
  }

  const distance = Math.abs(dx) + Math.abs(dy)
  if (!Number.isSafeInteger(distance) || distance > shape.length) {
    return []
  }

  const stepX = Math.sign(dx)
  const stepY = Math.sign(dy)
  const tiles: GridPosition[] = []
  for (let step = 1; step <= distance; step += 1) {
    const position = { x: origin.x + stepX * step, y: origin.y + stepY * step }
    if (!isWithinBoard(tactical, position)) return []
    tiles.push(position)
  }
  return tiles
}

export function validateCombatEncounterState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  const issues: CombatEncounterIssue[] = [
    ...validateTerrainOverlays(state),
    ...validateOngoingRecoveryState(state),
    ...validateBarrierState(state),
    ...validateCombatDotState(state),
    ...validateCombatTemporarySkillState(state),
  ]
  if (state.copyPolicyVersion !== undefined && state.copyPolicyVersion !== 1)
    issues.push({ field: 'copyPolicyVersion', message: 'Invalid pinned Copy policy.' })
  try {
    if (state.effectTimingPolicy !== undefined)
      parseCombatEffectTimingPolicy(state.effectTimingPolicy)
  } catch {
    issues.push({ field: 'effectTimingPolicy', message: 'Invalid pinned effect timing policy.' })
  }
  if (state.pendingEffects !== undefined) {
    if (
      !Array.isArray(state.pendingEffects) ||
      (state.pendingEffects.length > 0 && !state.effectTimingPolicy)
    )
      issues.push({
        field: 'pendingEffects',
        message: 'Pending effects require an array and pinned policy.',
      })
    else
      for (const pending of state.pendingEffects) {
        try {
          if (
            !pending ||
            !Number.isSafeInteger(pending.activationRound) ||
            pending.activationRound < 1 ||
            !state.tactical.battle.combatants.some((unit) => unit.id === pending.actorId) ||
            !Array.isArray(pending.recipientIds) ||
            pending.recipientIds.some(
              (id: string) => !state.tactical.battle.combatants.some((unit) => unit.id === id),
            ) ||
            !Array.isArray(pending.affectedTiles)
          )
            throw new Error('Invalid pending identity.')
          validateSourceCommandVisibility(state, pending.sourceCommandVisibility, pending.actorId)
          if (
            pending.effect.type === 'copy-statuses' &&
            pending.effect.beneficialEffects === true &&
            state.copyPolicyVersion !== 1
          )
            throw new TypeError('Pending beneficial Copy requires its pinned encounter policy.')
          if (
            pending.criticalRecipientIds !== undefined &&
            (!Array.isArray(pending.criticalRecipientIds) ||
              pending.criticalRecipientIds.some((id: string) => !pending.recipientIds.includes(id)))
          )
            throw new TypeError('Invalid pinned critical recipients.')
          if (pending.copySource) {
            if (
              pending.effect.type !== 'copy-statuses' ||
              !state.tactical.battle.combatants.some(
                (unit) => unit.id === pending.copySource!.combatantId,
              ) ||
              !Array.isArray(pending.copySource.statuses) ||
              (pending.copySource.beneficialPersistentEffects !== undefined &&
                pending.copySource.beneficialPersistentEffects !== true) ||
              (pending.copySource.beneficialPersistentEffects === true &&
                pending.effect.beneficialEffects !== true)
            )
              throw new TypeError('Invalid pinned copy source.')
            const snapshot = withStatusCopySource(
              {
                ...state,
                pendingEffects: undefined,
                pendingSkillGrants: undefined,
                pendingSummons: undefined,
              },
              pending.copySource,
            )
            if (validateCombatEncounterState(snapshot).length)
              throw new TypeError('Invalid pinned copy source state.')
          }
          if (pending.copyProvenance !== undefined) {
            if (
              pending.effect.type !== 'copy-statuses' ||
              pending.effect.beneficialEffects !== true ||
              pending.copyProvenance.sourceCombatantId !== pending.actorId ||
              pending.copyProvenance.actionDefinitionId !== pending.actionId
            )
              throw new TypeError('Invalid pending Copy provenance.')
            createCombatActionProvenance(pending.copyProvenance)
          }
          validateCombatContentCatalog(pending.content)
          if (
            !pending.effect ||
            ![
              'damage',
              'healing',
              'resource-change',
              'apply-status',
              'remove-status',
              'displace',
              'create-terrain',
              'poison',
              'burn',
              'bleed',
              'barrier-change',
              'return-to-turn-start',
              'copy-statuses',
            ].includes(pending.effect.type)
          )
            throw new Error('Invalid pending effect.')
          validateCombatActionDefinition(
            {
              ...P2_3_GUARD_ACTION,
              id: pending.actionId,
              target: {
                ...P2_3_GUARD_ACTION.target,
                kind: pending.effect.type === 'create-terrain' ? 'ground-tile' : 'unit',
              },
              effects: [
                pending.effect.type === 'copy-statuses'
                  ? { ...pending.effect, allowNoEligibleEffects: false }
                  : pending.effect,
              ],
              effectOrigins: [pending.effectOrigin],
              effectTimingTags: [pending.timingTag],
            },
            pending.content,
          )
          for (const tile of pending.affectedTiles) assertGridPosition(tile, 'pending tile')
        } catch {
          issues.push({ field: 'pendingEffects', message: 'Invalid pinned delayed effect.' })
        }
      }
  }
  if (state.pendingSummons !== undefined) {
    if (!Array.isArray(state.pendingSummons) || !state.effectTimingPolicy)
      issues.push({
        field: 'pendingSummons',
        message: 'Queued summons require an array and pinned policy.',
      })
    else
      for (const pending of state.pendingSummons) {
        try {
          const input = pending.input
          validateSourceCommandVisibility(
            state,
            pending.sourceCommandVisibility,
            input?.ownerCombatantId,
          )
          if (
            !Number.isSafeInteger(pending.activationRound) ||
            pending.activationRound < 1 ||
            !input ||
            !state.tactical.battle.combatants.some((unit) => unit.id === input.ownerCombatantId) ||
            typeof input.sourceSkillId !== 'string' ||
            !input.sourceSkillId.trim() ||
            !Number.isSafeInteger(input.sourceSkillVersion) ||
            input.sourceSkillVersion < 1 ||
            validateSummonProfileDefinition(input.profile).length ||
            !['north', 'east', 'south', 'west'].includes(input.facing) ||
            !isWithinBoard(state.tactical, input.position)
          )
            throw new Error('Invalid pending summon.')
        } catch {
          issues.push({
            field: 'pendingSummons',
            message: 'Queued summon identity and pinned profile must be valid.',
          })
        }
      }
  }
  if (state.pendingSkillGrants !== undefined) {
    if (!Array.isArray(state.pendingSkillGrants) || !state.effectTimingPolicy)
      issues.push({
        field: 'pendingSkillGrants',
        message: 'Queued Skill grants require an array and pinned policy.',
      })
    else {
      for (const pending of state.pendingSkillGrants) {
        try {
          validateSourceCommandVisibility(
            state,
            pending.sourceCommandVisibility,
            pending.grant.combatantId,
          )
        } catch {
          issues.push({ field: 'pendingSkillGrants', message: 'Invalid pinned grant visibility.' })
        }
      }
      for (const pending of state.pendingSkillGrants)
        if (!Number.isSafeInteger(pending.activationRound) || pending.activationRound < 1)
          issues.push({
            field: 'pendingSkillGrants',
            message: 'Queued Skill activation round must be positive.',
          })
      issues.push(
        ...validateCombatTemporarySkillState({
          ...state,
          effectState: {
            ...normalizeCombatEffectState(state.effectState),
            temporarySkills: state.pendingSkillGrants.map((row) => row.grant),
          },
        }),
      )
    }
  }
  collectPersistentProvenanceIssues(state, issues)

  if (state.schemaVersion !== COMBAT_ENCOUNTER_SCHEMA_VERSION) {
    issues.push({ field: 'schemaVersion', message: 'Unsupported combat-encounter schema version.' })
  }

  for (const issue of validateTacticalBattleState(state.tactical)) {
    issues.push({ field: `tactical.${issue.field}`, message: issue.message })
  }

  const expectedCombatantIds = [...state.tactical.battle.combatants]
    .map((combatant) => combatant.id)
    .sort(compareStableString)
  if (state.turnOrigin) {
    const origin = state.turnOrigin
    if (
      !expectedCombatantIds.includes(origin.combatantId) ||
      !Number.isSafeInteger(origin.turnNumber) ||
      origin.turnNumber < 1 ||
      origin.turnNumber > state.tactical.battle.turnNumber ||
      !Number.isSafeInteger(origin.position.x) ||
      !Number.isSafeInteger(origin.position.y) ||
      !isWithinBoard(state.tactical, origin.position)
    ) {
      issues.push({
        field: 'turnOrigin',
        message: 'Turn origin must reference a valid combatant, committed turn and board position.',
      })
    }
  }
  const actualCombatantIds = state.statusState.map((row) => row.combatantId)
  if (!arraysEqual(actualCombatantIds, expectedCombatantIds)) {
    issues.push({
      field: 'statusState',
      message: 'Status rows must cover every combatant exactly once in stable ID order.',
    })
  }

  const rowIds = new Set<string>()
  for (const [rowIndex, row] of state.statusState.entries()) {
    const prefix = `statusState.${rowIndex}`
    collectIdentityIssue(issues, row.combatantId, `${prefix}.combatantId`)
    if (rowIds.has(row.combatantId)) {
      issues.push({
        field: `${prefix}.combatantId`,
        message: 'Status row combatant IDs must be unique.',
      })
    }
    rowIds.add(row.combatantId)

    issues.push(...collectCombatStatusIdentityIssues(row.statuses, `${prefix}.statuses`))
    for (const [statusIndex, status] of row.statuses.entries()) {
      const statusPrefix = `${prefix}.statuses.${statusIndex}`
      collectIdentityIssue(issues, status.statusId, `${statusPrefix}.statusId`)
      collectIdentityIssue(issues, status.sourceCombatantId, `${statusPrefix}.sourceCombatantId`)
      collectPositiveIntegerIssue(issues, status.statusVersion, `${statusPrefix}.statusVersion`)
      collectPositiveIntegerIssue(issues, status.stacks, `${statusPrefix}.stacks`)
      collectPositiveIntegerIssue(
        issues,
        status.remainingOwnerTurnStarts,
        `${statusPrefix}.remainingOwnerTurnStarts`,
      )
      if (
        status.remainingOwnerTurnEnds !== undefined &&
        (!Number.isSafeInteger(status.remainingOwnerTurnEnds) || status.remainingOwnerTurnEnds < 1)
      )
        issues.push({
          field: `${statusPrefix}.remainingOwnerTurnEnds`,
          message: 'Affected-turn lifetime must be positive.',
        })
      if (
        status.potencyBasisPoints !== undefined &&
        (!Number.isSafeInteger(status.potencyBasisPoints) ||
          status.potencyBasisPoints < 100 ||
          status.potencyBasisPoints > 5_000)
      ) {
        issues.push({
          field: `${statusPrefix}.potencyBasisPoints`,
          message: 'Status potency must be from 1 to 50 percentage points.',
        })
      }
      if (!expectedCombatantIds.includes(status.sourceCombatantId)) {
        issues.push({
          field: `${statusPrefix}.sourceCombatantId`,
          message: 'Status source must reference a combatant in this encounter.',
        })
      }
    }
  }

  return issues
}

function collectPersistentProvenanceIssues(
  state: CombatEncounterState,
  issues: CombatEncounterIssue[],
): void {
  const collect = (value: unknown, field: string) => {
    if (value === undefined) return
    for (const message of validateCombatEffectInstanceProvenance(value)) {
      issues.push({ field, message })
    }
  }

  for (const [rowIndex, row] of state.statusState.entries()) {
    for (const [statusIndex, status] of row.statuses.entries()) {
      collect(status.provenance, `statusState.${rowIndex}.statuses.${statusIndex}.provenance`)
    }
  }

  const effectState = state.effectState as unknown as Record<string, unknown> | undefined
  if (!effectState || typeof effectState !== 'object' || Array.isArray(effectState)) return

  const collections: readonly (readonly [string, unknown])[] = [
    ['ongoingRecovery', effectState.ongoingRecovery],
    ['poison', effectState.poison],
    ['bleed', effectState.bleed],
    ['burn', effectState.burn],
    ['barriers', effectState.barriers],
  ]
  for (const [name, rows] of collections) {
    if (!Array.isArray(rows)) continue
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return
      collect(
        (row as { provenance?: unknown }).provenance,
        `effectState.${name}.${index}.provenance`,
      )
    })
  }
}

function resolvePrimaryTarget(
  state: CombatEncounterState,
  actorId: string,
  spec: CombatTargetSpec,
  selection: CombatTargetSelection,
  content: CombatContentCatalog,
  issues: CombatActionIssue[],
): { position: GridPosition | null; combatantId: string | null } {
  const actorPlacement = getPlacement(state.tactical, actorId)

  if (spec.kind === 'self') {
    if (selection.kind !== 'self') {
      issues.push({ code: 'invalid-target-kind', message: 'This action targets only the actor.' })
    }
    return { position: { ...actorPlacement.position }, combatantId: actorId }
  }

  if (spec.kind === 'unit') {
    if (selection.kind !== 'unit') {
      issues.push({ code: 'invalid-target-kind', message: 'This action requires a unit target.' })
      return { position: null, combatantId: null }
    }

    const target = state.tactical.battle.combatants.find(
      (combatant) => combatant.id === selection.combatantId,
    )
    if (!target) {
      issues.push({ code: 'target-not-found', message: 'The selected combatant does not exist.' })
      return { position: null, combatantId: null }
    }
    if (target.hp <= 0) {
      issues.push({
        code: 'target-defeated',
        message: 'The selected combatant is already defeated.',
      })
    }

    const actor = getCombatant(state.tactical.battle, actorId)
    if (actor.teamId !== target.teamId && hasGameplayTag(state, target.id, 'Invisible', content)) {
      issues.push({
        code: 'target-invisible',
        message: 'Invisible prevents hostile direct unit targeting; ground effects can still hit.',
      })
    }
    if (!isTeamPolicyAllowed(actor, target, spec.teamPolicy)) {
      issues.push({
        code: 'target-team-not-allowed',
        message: 'The selected combatant does not satisfy the action team policy.',
      })
    }

    return {
      position: { ...getPlacement(state.tactical, target.id).position },
      combatantId: target.id,
    }
  }

  if (selection.kind !== 'tile') {
    issues.push({ code: 'invalid-target-kind', message: 'This action requires a tile target.' })
    return { position: null, combatantId: null }
  }

  if (!isWithinBoard(state.tactical, selection.position)) {
    issues.push({ code: 'target-not-found', message: 'The selected tile is outside the board.' })
    return { position: null, combatantId: null }
  }

  const occupant = getOccupantId(state.tactical, selection.position)
  if (spec.kind === 'empty-tile' && occupant !== null) {
    issues.push({
      code: 'target-tile-occupied',
      message: 'This action requires an empty target tile.',
    })
  }

  return { position: { ...selection.position }, combatantId: occupant }
}

function collectSpatialTargetIssues(
  state: CombatEncounterState,
  actorId: string,
  spec: CombatTargetSpec,
  targetPosition: GridPosition,
  issues: CombatActionIssue[],
): void {
  const actorPosition = getPlacement(state.tactical, actorId).position
  const distance = manhattanDistance(actorPosition, targetPosition)
  if (distance < spec.minimumRange || distance > spec.maximumRange) {
    issues.push({
      code: 'target-out-of-range',
      message: 'The selected target is outside the action range.',
    })
  }

  if (spec.maximumElevationDifference !== null) {
    const actorTile = getTile(state.tactical, actorPosition)
    const targetTile = getTile(state.tactical, targetPosition)
    if (Math.abs(actorTile.elevation - targetTile.elevation) > spec.maximumElevationDifference) {
      issues.push({
        code: 'target-elevation-invalid',
        message: 'The elevation difference exceeds the action target limit.',
      })
    }
  }

  if (spec.requiresLineOfSight && !hasBaselineLineOfSight(state, actorPosition, targetPosition)) {
    issues.push({
      code: 'line-of-sight-blocked',
      message: 'Blocking terrain interrupts line of sight to the selected target.',
    })
  }
}

function collectRequirementIssues(
  state: CombatEncounterState,
  actorId: string,
  targetId: string | null,
  requirements: readonly CombatUseRequirement[],
  content: CombatContentCatalog,
  issues: CombatActionIssue[],
): void {
  const actor = getCombatant(state.tactical.battle, actorId)

  for (const requirement of requirements) {
    if ('tag' in requirement) {
      const ownerId = requirement.kind === 'target-tag-present' ? targetId : actorId
      const present = !!ownerId && hasGameplayTag(state, ownerId, requirement.tag, content)
      if (requirement.kind === 'actor-tag-absent' ? present : !present)
        issues.push({
          code: 'requirement-not-met',
          message: `${requirement.kind === 'target-tag-present' ? 'Target' : 'Actor'} ${requirement.kind === 'actor-tag-absent' ? 'must not have' : 'requires'} ${requirement.tag}.`,
        })
      continue
    }
    if (requirement.kind === 'actor-status-present') {
      if (!hasStatus(state, actorId, requirement.statusId)) {
        issues.push({
          code: 'requirement-not-met',
          message: `Actor requires status ${requirement.statusId}.`,
        })
      }
      continue
    }

    if (requirement.kind === 'actor-status-absent') {
      if (hasStatus(state, actorId, requirement.statusId)) {
        issues.push({
          code: 'requirement-not-met',
          message: `Actor must not already have status ${requirement.statusId}.`,
        })
      }
      continue
    }

    if (requirement.kind === 'target-status-present') {
      if (!targetId || !hasStatus(state, targetId, requirement.statusId)) {
        issues.push({
          code: 'requirement-not-met',
          message: `Target requires status ${requirement.statusId}.`,
        })
      }
      continue
    }

    const hpBasisPoints = scaleRatioToBasisPoints(actor.hp, actor.maxHp)
    if (hpBasisPoints > requirement.basisPoints) {
      issues.push({
        code: 'requirement-not-met',
        message: 'Actor HP is above the action requirement threshold.',
      })
    }
  }
}

function resolveAffectedCombatants(
  state: CombatEncounterState,
  actorId: string,
  primaryCombatantId: string | null,
  spec: CombatTargetSpec,
  affectedTiles: readonly GridPosition[],
): string[] {
  const actor = getCombatant(state.tactical.battle, actorId)

  if (spec.shape.kind === 'single') {
    if (!primaryCombatantId) return []
    const target = getCombatant(state.tactical.battle, primaryCombatantId)
    return target.hp > 0 && isFriendlyFireAllowed(actor, target, spec.friendlyFire)
      ? [primaryCombatantId]
      : []
  }

  return state.tactical.placements
    .filter((placement) =>
      affectedTiles.some((position) => positionsEqual(position, placement.position)),
    )
    .filter((placement) => {
      const target = getCombatant(state.tactical.battle, placement.combatantId)
      return target.hp > 0 && isFriendlyFireAllowed(actor, target, spec.friendlyFire)
    })
    .map((placement) => placement.combatantId)
    .sort(compareStableString)
}

function collectSelfDamageIssues(
  effects: readonly CombatEffectDefinition[],
  actorId: string,
  primaryCombatantId: string | null,
  affectedCombatantIds: readonly string[],
  issues: CombatActionIssue[],
): void {
  for (const effect of effects) {
    if (effect.type !== 'damage') continue
    const recipients = resolveEffectRecipients(
      actorId,
      primaryCombatantId,
      affectedCombatantIds,
      effect.recipient,
    )
    if (recipients.includes(actorId)) {
      issues.push({
        code: 'self-damage-deferred',
        message: 'P2.3 self-damage is deferred until the self-defeat lifecycle is defined.',
      })
      return
    }
  }
}

function collectEffectRecipientIssues(
  effects: readonly CombatEffectDefinition[],
  primaryCombatantId: string | null,
  affectedCombatantIds: readonly string[],
  issues: CombatActionIssue[],
  allowsEmptyArea: boolean,
): void {
  for (const effect of effects) {
    if (effect.recipient === 'primary-unit' && !primaryCombatantId) {
      issues.push({
        code: 'effect-target-missing',
        message: 'An effect requires a primary unit target that is not available.',
      })
    }
    if (
      effect.recipient === 'affected-units' &&
      affectedCombatantIds.length === 0 &&
      !allowsEmptyArea
    ) {
      issues.push({
        code: 'effect-target-missing',
        message: 'An area effect resolves to no affected combatants.',
      })
    }
  }
}

/** Preview and commit run this exact immutable sequence, including consumptions and failed pushes. */
function resolveActionEffects(
  state: CombatEncounterState,
  actorId: string,
  primaryCombatantId: string | null,
  affectedCombatantIds: readonly string[],
  affectedTiles: readonly GridPosition[],
  action: CombatActionDefinition,
  content: CombatContentCatalog,
  missedCombatantIds?: ReadonlySet<string>,
  criticalEffectOrdinalsByTarget?: ReadonlyMap<string, ReadonlySet<number>>,
  resolvingPending = false,
): CombatResolutionTransition & {
  projections: CombatEffectProjection[]
  terrain: CombatTerrainProjection[]
} {
  let nextState = state
  const events: CombatResolutionEvent[] = []
  const projections: CombatEffectProjection[] = []
  const terrain: CombatTerrainProjection[] = []
  const stormRecipients = new Set<string>()
  if (action.effects.some((effect) => effect.type === 'damage' && effect.amount > 0)) {
    const revealed = removeGameplayTags(
      nextState,
      actorId,
      actorId,
      action.id,
      ['Invisible'],
      content,
    )
    nextState = revealed.state
    events.push(...revealed.events)
  }
  for (const [effectOrdinal, effect] of action.effects.entries()) {
    const firstEvent = events.length
    try {
      if (effect.type === 'sensory') {
        throw new TypeError('Sensory must be materialized before legacy effect resolution.')
      }
      if (effect.type === 'copy') {
        throw new TypeError('Copy must be materialized before legacy effect resolution.')
      }
      if (
        !resolvingPending &&
        combatEffectTimingMode(
          state.effectTimingPolicy,
          action.effectTimingTags?.[effectOrdinal] ?? combatEffectTimingTag(effect),
        ) === 'next-round'
      ) {
        const recipientIds = (
          effect.recipient === 'affected-tiles'
            ? []
            : resolveEffectRecipients(
                actorId,
                primaryCombatantId,
                affectedCombatantIds,
                effect.recipient,
              )
        ).filter((id) => !missedCombatantIds?.has(id))
        if (!recipientIds.length && effect.type !== 'create-terrain') continue
        nextState = {
          ...nextState,
          pendingEffects: [
            ...(nextState.pendingEffects ?? []),
            {
              actorId,
              sourceCommandVisibility: combatSourceCommandVisibility(state, actorId),
              criticalRecipientIds: recipientIds.filter((id) =>
                criticalEffectOrdinalsByTarget?.get(id)?.has(effectOrdinal),
              ),
              actionId: action.id,
              ...(action.effectTimingTags?.[effectOrdinal]
                ? { timingTag: action.effectTimingTags[effectOrdinal] }
                : {}),
              ...(action.effectOrigins?.[effectOrdinal]
                ? { effectOrigin: { ...action.effectOrigins[effectOrdinal] } }
                : {}),
              ...(effect.type === 'copy-statuses'
                ? {
                    copySource: captureStatusCopySource(
                      nextState,
                      effect.mode === 'amplify' ? recipientIds[0]! : actorId,
                      effect.beneficialEffects === true,
                    ),
                  }
                : {}),
              effect: JSON.parse(JSON.stringify(effect)) as CombatEffectDefinition,
              recipientIds,
              affectedTiles: affectedTiles.map((tile) => ({ ...tile })),
              activationRound: state.tactical.battle.round + 1,
              content: JSON.parse(JSON.stringify(content)) as CombatContentCatalog,
              ...(state.turnOrigin
                ? {
                    turnOrigin: { ...state.turnOrigin, position: { ...state.turnOrigin.position } },
                  }
                : {}),
            },
          ],
        }
        if (effect.type === 'create-terrain') {
          for (const position of affectedTiles) {
            const projected = setTerrainOverlay(nextState, position, 'frozen', actorId, action.id)
            for (const event of projected.events)
              if (event.event === 'terrain_overlay_changed')
                terrain.push({
                  position: event.position,
                  before: event.before,
                  after: event.after,
                  remainingRoundBoundaries: event.remainingRoundBoundaries,
                  activationRound: state.tactical.battle.round + 1,
                })
          }
        }
        const latestPending = nextState.pendingEffects![nextState.pendingEffects!.length - 1]!
        if (effect.type !== 'create-terrain')
          for (const { combatantId, status } of pendingCombatStatusRows({
            tactical: nextState.tactical,
            pendingEffects: [latestPending],
          }))
            projections.push({
              effectType: effect.type,
              combatantId,
              before: 'none',
              after: 'pending',
              activationRound: status.activationRound,
              statusId: status.statusId,
              ...(status.durationScope ? { durationScope: status.durationScope } : {}),
              ...(status.remainingOwnerTurnEnds === undefined
                ? {}
                : { remainingOwnerTurnEnds: status.remainingOwnerTurnEnds }),
              ...(status.remainingRoundBoundaries === undefined
                ? {}
                : { remainingRoundBoundaries: status.remainingRoundBoundaries }),
            })
        for (const targetCombatantId of recipientIds.length ? recipientIds : [null])
          events.push({
            event: 'effect_pending',
            actionId: action.id,
            sourceCombatantId: actorId,
            targetCombatantId,
            effectTag:
              effect.type === 'copy-statuses' && effect.beneficialEffects === true
                ? 'beneficial-copy'
                : combatEffectTimingTag(effect),
            activationRound: state.tactical.battle.round + 1,
          })
        continue
      }
      if (
        effect.type === 'create-terrain' ||
        (effect.type === 'damage' && effect.element === 'fire')
      ) {
        for (const position of affectedTiles) {
          if (
            effect.type !== 'create-terrain' &&
            terrainOverlayAt(nextState, position)?.kind !== 'frozen'
          )
            continue
          const changed = setTerrainOverlay(
            nextState,
            position,
            effect.type === 'create-terrain' ? 'frozen' : 'steam',
            actorId,
            action.id,
          )
          nextState = changed.state
          events.push(...changed.events)
          for (const event of changed.events)
            if (event.event === 'terrain_overlay_changed') {
              terrain.push({
                position: event.position,
                before: event.before,
                after: event.after,
                remainingRoundBoundaries: event.remainingRoundBoundaries,
              })
            }
        }
        if (effect.type === 'create-terrain') continue
      }
      for (const recipientId of resolveEffectRecipients(
        actorId,
        primaryCombatantId,
        affectedCombatantIds,
        effect.recipient,
      )) {
        // Engine-owned target roll gates every unit effect, not just damage packets.
        if (missedCombatantIds?.has(recipientId)) continue
        if (effect.type === 'copy-statuses') {
          const copied = applyCombatStatusCopies(
            nextState,
            actorId,
            recipientId,
            action.id,
            effect,
            content,
            resolvingPending,
          )
          nextState = copied.state
          events.push(...copied.events)
          projections.push(...copied.projections)
          continue
        }
        const before = nextState
        const applied = applyEffect(
          nextState,
          actorId,
          recipientId,
          action.id,
          effect,
          content,
          stormRecipients,
          criticalEffectOrdinalsByTarget?.get(recipientId)?.has(effectOrdinal) === true,
          resolvingPending,
        )
        nextState = applied.state
        if (
          !resolvingPending &&
          state.effectTimingPolicy &&
          state.tactical.battle.currentTurn?.combatantId === recipientId &&
          ['poison', 'burn', 'bleed'].includes(effect.type)
        ) {
          const effectState = normalizeCombatEffectState(nextState.effectState)
          const mark = (row: {
            targetCombatantId: string
            sourceCombatantId: string
            sourceActionId: string
          }) =>
            row.targetCombatantId === recipientId &&
            row.sourceCombatantId === actorId &&
            row.sourceActionId === action.id
              ? { ...row, skipCurrentOwnerTurnEnd: true }
              : row
          nextState = {
            ...nextState,
            effectState: {
              ...effectState,
              poison: effectState.poison.map((row) => mark(row) as typeof row),
              burn: effectState.burn.map((row) => mark(row) as typeof row),
              bleed: effectState.bleed.map((row) => mark(row) as typeof row),
            },
          }
        }
        events.push(...applied.events)
        if (effect.type === 'poison' || effect.type === 'burn' || effect.type === 'bleed')
          events.push({
            event: 'persistent_effect_applied',
            actionId: action.id,
            sourceCombatantId: actorId,
            targetCombatantId: recipientId,
            statusId: effect.type,
          })
        let beforeValue: number | string
        let afterValue: number | string
        if (
          effect.type === 'damage' ||
          effect.type === 'healing' ||
          effect.type === 'resource-change'
        ) {
          const resource = effect.type === 'resource-change' ? 'mp' : 'hp'
          beforeValue = getCombatant(before.tactical.battle, recipientId)[resource]
          afterValue = getCombatant(nextState.tactical.battle, recipientId)[resource]
        } else if (effect.type === 'barrier-change') {
          beforeValue = currentBarrierAmount(before, recipientId)
          afterValue = currentBarrierAmount(nextState, recipientId)
        } else if (effect.type === 'return-to-turn-start' || effect.type === 'displace') {
          const from = getPlacement(before.tactical, recipientId).position
          const to = getPlacement(nextState.tactical, recipientId).position
          beforeValue = `${from.x},${from.y}`
          afterValue = `${to.x},${to.y}`
        } else if (effect.type === 'poison') {
          beforeValue =
            before.effectState?.poison.some(
              (instance) => instance.targetCombatantId === recipientId,
            ) === true
              ? 'active'
              : 'none'
          afterValue =
            nextState.effectState?.poison.some(
              (instance) => instance.targetCombatantId === recipientId,
            ) === true
              ? 'active'
              : 'none'
        } else if (effect.type === 'bleed') {
          beforeValue = `x${currentBleedStacks(before, recipientId).length}`
          afterValue = `x${currentBleedStacks(nextState, recipientId).length}`
        } else if (effect.type === 'burn') {
          beforeValue = currentBurnInstance(before, recipientId)?.stage ?? 'none'
          afterValue = currentBurnInstance(nextState, recipientId)?.stage ?? 'none'
        } else if (effect.type === 'remove-status') {
          const removedStatusIds = getStatusRow(before, recipientId)
            .statuses.filter((status) => effect.statusIds.includes(status.statusId))
            .map((status) => status.statusId)
          if (effect.statusIds.includes('poison') && hasCurrentPoison(before, recipientId)) {
            removedStatusIds.push('poison')
          }
          if (effect.statusIds.includes('bleed') && hasCurrentBleed(before, recipientId)) {
            removedStatusIds.push('bleed')
          }
          if (effect.statusIds.includes('burn') && hasCurrentBurn(before, recipientId)) {
            removedStatusIds.push('burn')
          }
          beforeValue = [...new Set(removedStatusIds)].sort(compareStableString).join(',') || 'none'
          afterValue = 'none'
        } else {
          const oldStatus = getStatus(before, recipientId, effect.statusId, actorId)
          const newStatus = getStatus(nextState, recipientId, effect.statusId, actorId)
          beforeValue = oldStatus ? `${oldStatus.statusId}:${oldStatus.stacks}` : 'none'
          afterValue = newStatus ? `${newStatus.statusId}:${newStatus.stacks}` : 'none'
        }
        projections.push({
          effectType: effect.type,
          combatantId: recipientId,
          before: beforeValue,
          after: afterValue,
        })
      }
    } finally {
      if (!resolvingPending && nextState.effectTimingPolicy) {
        const activeId = state.tactical.battle.currentTurn?.combatantId
        const appliedStatusIds = events
          .slice(firstEvent)
          .flatMap((event) =>
            event.event === 'status_applied' && event.targetCombatantId === activeId
              ? [event.statusId]
              : [],
          )
        if (appliedStatusIds.length)
          nextState = {
            ...nextState,
            statusState: nextState.statusState.map((row) =>
              row.combatantId === activeId
                ? {
                    ...row,
                    statuses: row.statuses.map((status) =>
                      appliedStatusIds.includes(status.statusId) &&
                      status.remainingOwnerTurnEnds !== undefined
                        ? { ...status, skipCurrentOwnerTurnEnd: true }
                        : status,
                    ),
                  }
                : row,
            ),
          }
      }
      const origin = action.effectOrigins?.[effectOrdinal]
      if (origin)
        for (let index = firstEvent; index < events.length; index += 1)
          events[index] = { ...events[index]!, effectOrigin: { ...origin } }
    }
  }
  return { state: nextState, events, projections, terrain }
}

/** Also used by the stat-driven miss path: a damaging command reveals its holder even on a miss. */
export function removeGameplayTags(
  state: CombatEncounterState,
  actorId: string,
  recipientId: string,
  actionId: string,
  tags: readonly GameplayTag[],
  content: CombatContentCatalog,
): CombatResolutionTransition {
  const ids = [
    ...new Set(tags.flatMap((tag) => statusIdsForGameplayTag(state, recipientId, tag, content))),
  ]
  return {
    state: removeStatuses(state, recipientId, ids),
    events: ids.map((statusId) => ({
      event: 'status_removed',
      actionId,
      sourceCombatantId: actorId,
      targetCombatantId: recipientId,
      statusId,
    })),
  }
}

function applyEffect(
  state: CombatEncounterState,
  actorId: string,
  recipientId: string,
  actionId: string,
  effect: Exclude<
    CombatEffectDefinition,
    { type: 'create-terrain' | 'copy-statuses' | 'copy' | 'sensory' }
  >,
  content: CombatContentCatalog,
  stormRecipients: Set<string>,
  critical: boolean,
  resolvingPending = false,
): CombatResolutionTransition {
  if (effect.type === 'displace')
    return applyDisplacement(state, actorId, recipientId, actionId, effect, content)
  if (effect.type === 'poison') {
    const tuning = effect as typeof effect & { power?: number; durationTurns?: number }
    return {
      state: applyCurrentPoisonState(
        state,
        actorId,
        recipientId,
        actionId,
        effect.curseCopyable,
        tuning.power,
        tuning.durationTurns,
      ),
      events: [],
    }
  }
  if (effect.type === 'bleed') {
    return {
      state: applyCurrentBleedState(
        state,
        actorId,
        recipientId,
        actionId,
        effect.damagePerTick,
        effect.ticks,
        effect.curseCopyable,
      ),
      events: [],
    }
  }
  if (effect.type === 'burn') {
    const tuning = effect as typeof effect & { power?: number; durationTurns?: number }
    return {
      state: applyCurrentBurnState(
        state,
        actorId,
        recipientId,
        actionId,
        effect.curseCopyable,
        tuning.power,
        tuning.durationTurns,
      ),
      events: [],
    }
  }
  if (effect.type === 'barrier-change') {
    const changed = grantBarrier(state, actorId, recipientId, actionId, effect.amount)
    return {
      state: changed.state,
      events: [
        {
          event: 'barrier_changed',
          actionId,
          sourceCombatantId: actorId,
          targetCombatantId: recipientId,
          amount: changed.applied,
          before: changed.before,
          after: changed.after,
        },
      ],
    }
  }
  if (effect.type === 'return-to-turn-start') {
    const from = getPlacement(state.tactical, actorId).position
    const to = state.turnOrigin!.position
    return {
      state: rewindToTurnOrigin(state, actorId),
      events: [
        {
          event: 'combatant_rewound',
          actionId,
          combatantId: actorId,
          from: { ...from },
          to: { ...to },
        },
      ],
    }
  }

  if (effect.type === 'damage') {
    const target = getCombatant(state.tactical.battle, recipientId)
    const stormBonus =
      effect.element === 'storm' &&
      !stormRecipients.has(recipientId) &&
      (hasGameplayTag(state, recipientId, 'Wet', content) ||
        hasGameplayTag(state, recipientId, 'Conductive', content))
    const amount = resolveDamageAmount(
      state,
      actorId,
      recipientId,
      effect,
      content,
      stormBonus ? 12_000 : 10_000,
      critical,
    )
    if (stormBonus && amount > 0) stormRecipients.add(recipientId)
    const barrier = absorbDirectDamageWithBarrier(state, recipientId, amount)
    const hpAfter = Math.max(0, target.hp - barrier.remainingDamage)
    const defeatedCurrent =
      resolvingPending &&
      hpAfter === 0 &&
      barrier.state.tactical.battle.currentTurn?.combatantId === recipientId
        ? defeatCombatActionActor(barrier.state, recipientId, content)
        : null
    const updated =
      defeatedCurrent?.state ??
      withUpdatedCombatant(barrier.state, recipientId, { ...target, hp: hpAfter })
    const removed =
      hpAfter < target.hp
        ? removeGameplayTags(
            updated,
            actorId,
            recipientId,
            actionId,
            [
              'Invisible',
              ...(effect.element === 'fire' ? (['Wet', 'Frozen'] as const) : []),
              ...(stormBonus ? (['Conductive'] as const) : []),
            ],
            content,
          )
        : { state: updated, events: [] }
    return {
      state: removed.state,
      events: [
        ...(barrier.absorbed > 0
          ? [
              {
                event: 'barrier_absorbed' as const,
                actionId,
                sourceCombatantId: actorId,
                targetCombatantId: recipientId,
                amount: barrier.absorbed,
                before: barrier.before,
                after: barrier.after,
              },
            ]
          : []),
        {
          event: 'damage_applied',
          actionId,
          sourceCombatantId: actorId,
          targetCombatantId: recipientId,
          amount: target.hp - hpAfter,
          hpBefore: target.hp,
          hpAfter,
        },
        ...removed.events,
        ...(defeatedCurrent?.events ?? []),
      ],
    }
  }

  if (effect.type === 'healing' || effect.type === 'resource-change') {
    const immediate = applyImmediateRecovery(state, actorId, recipientId, actionId, effect, content)
    if (effect.type === 'resource-change' && effect.delta < 0) return immediate
    return scheduleAfterRecovery(
      immediate,
      actorId,
      recipientId,
      actionId,
      effect.type === 'healing' ? 'hp' : 'mp',
      effect.type === 'healing' ? effect.amount : effect.delta,
      effect.ticks ?? 1,
    )
  }

  if (effect.type === 'remove-status') {
    const removedStatusIds = getStatusRow(state, recipientId)
      .statuses.filter((status) => effect.statusIds.includes(status.statusId))
      .map((status) => status.statusId)
    const removesCurrentPoison =
      effect.statusIds.includes('poison') && hasCurrentPoison(state, recipientId)
    const removesCurrentBleed =
      effect.statusIds.includes('bleed') && hasCurrentBleed(state, recipientId)
    const removesCurrentBurn =
      effect.statusIds.includes('burn') && hasCurrentBurn(state, recipientId)
    if (removesCurrentPoison) removedStatusIds.push('poison')
    if (removesCurrentBleed) removedStatusIds.push('bleed')
    if (removesCurrentBurn) removedStatusIds.push('burn')

    let nextState = removeStatuses(state, recipientId, effect.statusIds)
    if (removesCurrentPoison) nextState = removeCurrentPoisonState(nextState, recipientId)
    if (removesCurrentBleed) nextState = removeCurrentBleedState(nextState, recipientId)
    if (removesCurrentBurn) nextState = removeCurrentBurnState(nextState, recipientId)

    return {
      state: nextState,
      events: [...new Set(removedStatusIds)].sort(compareStableString).map((statusId) => ({
        event: 'status_removed' as const,
        actionId,
        sourceCombatantId: actorId,
        targetCombatantId: recipientId,
        statusId,
      })),
    }
  }

  const existingStatus = getStatus(state, recipientId, effect.statusId, actorId)
  const tuning = effect as typeof effect & {
    durationTurns?: number
    potencyBasisPoints?: number
  }
  const nextState = applyStatusState(
    state,
    actorId,
    recipientId,
    effect.statusId,
    effect.stacks,
    content,
    tuning.durationTurns,
    tuning.potencyBasisPoints,
  )
  const status = getStatus(nextState, recipientId, effect.statusId, actorId)
  if (!status) {
    throw new Error(`Status ${effect.statusId} was not applied.`)
  }

  return {
    state: nextState,
    events: [
      {
        event: 'status_applied',
        actionId,
        sourceCombatantId: actorId,
        targetCombatantId: recipientId,
        statusId: status.statusId,
        stacks: status.stacks,
        remainingOwnerTurnStarts: status.remainingOwnerTurnStarts,
        ...(status.remainingOwnerTurnEnds !== undefined
          ? { expiryBoundary: 'owner-turn-end' as const }
          : {}),
        refreshed: existingStatus !== null,
        stacked: existingStatus !== null && status.stacks > existingStatus.stacks,
      },
    ],
  }
}

function rewindToTurnOrigin(state: CombatEncounterState, actorId: string): CombatEncounterState {
  return {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((unit) =>
        unit.combatantId === actorId
          ? { ...unit, position: { ...state.turnOrigin!.position } }
          : unit,
      ),
    },
  }
}

function resolveDamageAmount(
  state: CombatEncounterState,
  actorId: string,
  recipientId: string,
  effect: Extract<CombatEffectDefinition, { type: 'damage' }>,
  content: CombatContentCatalog,
  elementalMultiplier = 10_000,
  critical = false,
): number {
  let amount = effect.amount
  if (effect.defenseKind && amount > 0 && effect.piercing !== true) {
    const defense = state.statBridge?.combatants.find((unit) => unit.combatantId === recipientId)?.[
      effect.defenseKind
    ]
    if (defense === undefined)
      throw new TypeError('Stat-driven Skill damage requires recipient defenses.')
    amount = mitigateDamageByDefense(amount, defense)
  }

  if (critical && amount > 0) {
    amount = scaleByBasisPoints(amount, COMBAT_CRITICAL_DAMAGE_BASIS_POINTS)
  }

  if (
    (state.statBridge?.rulesVersion === 3 || state.statBridge?.rulesVersion === 4) &&
    actorId !== recipientId &&
    amount > 0
  ) {
    const attacker = state.statBridge.combatants.find((unit) => unit.combatantId === actorId)
    const defender = state.statBridge.combatants.find((unit) => unit.combatantId === recipientId)
    if (attacker?.level === undefined || defender?.level === undefined) {
      throw new TypeError('Combat rules v3 damage requires attacker and defender Levels.')
    }
    amount = scaleByBasisPoints(
      amount,
      combatLevelDamageModifierBasisPoints(attacker.level, defender.level),
    )
  }

  if (effect.facingModifiersBasisPoints && actorId !== recipientId) {
    const actorPlacement = getPlacement(state.tactical, actorId)
    const targetPlacement = getPlacement(state.tactical, recipientId)
    const relation = classifyFacingRelation(
      targetPlacement.position,
      targetPlacement.facing,
      actorPlacement.position,
    )
    amount = scaleByBasisPoints(amount, effect.facingModifiersBasisPoints[relation])
  }

  for (const status of getStatusRow(state, recipientId).statuses) {
    const definition = getStatusDefinition(content, status.statusId, status.statusVersion)
    const authoredPotency = status.potencyBasisPoints
    const damageTakenMultiplier =
      authoredPotency === undefined
        ? definition.damageTakenMultiplierBasisPoints
        : definition.damageTakenMultiplierBasisPoints < 10_000
          ? Math.max(0, 10_000 - authoredPotency)
          : definition.damageTakenMultiplierBasisPoints > 10_000
            ? 10_000 + authoredPotency
            : 10_000
    if (effect.piercing === true && damageTakenMultiplier < 10_000) continue
    for (let stack = 0; stack < status.stacks; stack += 1) {
      amount = scaleByBasisPoints(amount, damageTakenMultiplier)
    }
  }

  amount = scaleByBasisPoints(
    amount,
    conditionalDamageMultiplier(state, actorId, recipientId, content, elementalMultiplier, {
      ignoreIncomingMitigation: effect.piercing === true,
    }),
  )

  return amount
}

function applyStatusState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  recipientId: string,
  statusId: string,
  stacks: number,
  content: CombatContentCatalog,
  durationTurns?: number,
  potencyBasisPoints?: number,
): CombatEncounterState {
  assertPositiveSafeInteger(stacks, 'status stacks')
  if (
    durationTurns !== undefined &&
    (!Number.isSafeInteger(durationTurns) || durationTurns < 1 || durationTurns > 4)
  ) {
    throw new RangeError('Persistent status duration must be an integer from 1 to 4 turns.')
  }
  if (
    potencyBasisPoints !== undefined &&
    (!Number.isSafeInteger(potencyBasisPoints) ||
      potencyBasisPoints < 100 ||
      potencyBasisPoints > 5_000)
  ) {
    throw new RangeError('Status potency must be from 1 to 50 percentage points.')
  }
  const definition = getStatusDefinitionById(content, statusId)
  const remainingOwnerTurnStarts =
    durationTurns === undefined ? definition.durationOwnerTurnStarts : durationTurns + 1
  const existing = getStatus(state, recipientId, statusId, sourceCombatantId)
  const nextStacks = existing
    ? addClampedSafeInteger(existing.stacks, stacks, 1, definition.maximumStacks)
    : Math.min(definition.maximumStacks, stacks)
  const nextStatus: CombatStatusInstance = existing
    ? {
        ...existing,
        stacks: nextStacks,
        remainingOwnerTurnStarts,
        sourceCombatantId,
        ...(potencyBasisPoints !== undefined ? { potencyBasisPoints } : {}),
      }
    : {
        ...(definition.markAccuracyBonusBasisPoints !== undefined
          ? { sourceScopedMark: true as const }
          : {}),
        statusId: definition.id,
        statusVersion: definition.version,
        stacks: nextStacks,
        remainingOwnerTurnStarts,
        sourceCombatantId,
        ...(potencyBasisPoints !== undefined ? { potencyBasisPoints } : {}),
      }

  if (state.effectTimingPolicy) {
    nextStatus.timingState = 'active'
    nextStatus.remainingOwnerTurnEnds =
      durationTurns ??
      Math.max(1, definition.durationOwnerTurnStarts - (definition.endOfTurn ? 0 : 1))
    nextStatus.remainingOwnerTurnStarts = nextStatus.remainingOwnerTurnEnds
  }
  const statusState = state.statusState.map((candidate) =>
    candidate.combatantId === recipientId
      ? {
          ...candidate,
          statuses: [
            ...candidate.statuses.filter((status) => status !== existing),
            nextStatus,
          ].sort(compareCombatStatusInstances),
        }
      : candidate,
  )
  const nextState = { ...state, statusState }
  assertValidCombatEncounterState(nextState)
  return nextState
}

function expireOwnerTurnStartStatuses(
  state: CombatEncounterState,
  combatantId: string,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  const row = getStatusRow(state, combatantId)
  const kept: CombatStatusInstance[] = []
  const events: CombatResolutionEvent[] = []

  for (const status of row.statuses) {
    const definition = getStatusDefinition(content, status.statusId, status.statusVersion)
    if (
      status.remainingOwnerTurnEnds !== undefined ||
      definition.endOfTurn ||
      definition.nextRoundInitiative !== undefined
    ) {
      kept.push(status)
      continue
    }
    const remaining = status.remainingOwnerTurnStarts - 1
    if (remaining <= 0) {
      events.push({
        event: 'status_expired',
        combatantId,
        statusId: status.statusId,
        ...(status.sourceScopedMark === true
          ? { sourceCombatantId: status.sourceCombatantId }
          : {}),
      })
    } else {
      kept.push({ ...status, remainingOwnerTurnStarts: remaining })
    }
  }

  const statusState = state.statusState.map((candidate) =>
    candidate.combatantId === combatantId ? { ...candidate, statuses: kept } : candidate,
  )
  const nextState = { ...state, statusState }
  assertValidCombatEncounterState(nextState)
  return { state: nextState, events }
}

function removeStatuses(
  state: CombatEncounterState,
  recipientId: string,
  statusIds: readonly string[],
): CombatEncounterState {
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === recipientId
        ? {
            ...row,
            statuses: row.statuses.filter((status) => !statusIds.includes(status.statusId)),
          }
        : row,
    ),
  }
}

function resolveEndOfTurnStatuses(
  state: CombatEncounterState,
  combatantId: string,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  let nextState = state
  const events: CombatResolutionEvent[] = []
  for (const status of getStatusRow(state, combatantId).statuses) {
    const definition = getStatusDefinition(content, status.statusId, status.statusVersion)
    if (!definition.endOfTurn) continue
    // Periodic values are fixed, do not roll accuracy, and do not trigger ordinary on-hit modifiers.
    const target = getCombatant(nextState.tactical.battle, combatantId)
    if (target.hp > 0) {
      const amount = definition.endOfTurn.amount * status.stacks
      const hpAfter =
        definition.endOfTurn.type === 'damage'
          ? Math.max(0, target.hp - amount)
          : Math.min(
              target.maxHp,
              target.hp + incomingHealingAmount(nextState, combatantId, amount, content),
            )
      nextState = withUpdatedCombatant(nextState, combatantId, { ...target, hp: hpAfter })
      events.push({
        event: definition.endOfTurn.type === 'damage' ? 'damage_applied' : 'healing_applied',
        actionId: `status.${status.statusId}`,
        sourceCombatantId: status.sourceCombatantId,
        targetCombatantId: combatantId,
        amount: Math.abs(target.hp - hpAfter),
        hpBefore: target.hp,
        hpAfter,
      })
    }
    if (definition.endOfTurn.type === 'damage' && target.hp > 0) {
      const revealed = removeGameplayTags(
        nextState,
        status.sourceCombatantId,
        combatantId,
        `status.${status.statusId}`,
        ['Invisible'],
        content,
      )
      nextState = revealed.state
      events.push(...revealed.events)
    }
    if (status.remainingOwnerTurnEnds !== undefined) continue
    const remaining = status.remainingOwnerTurnStarts - 1
    if (remaining === 0) {
      nextState = removeStatuses(nextState, combatantId, [status.statusId])
      events.push({ event: 'status_expired', combatantId, statusId: status.statusId })
    } else {
      nextState = {
        ...nextState,
        statusState: nextState.statusState.map((row) =>
          row.combatantId === combatantId
            ? {
                ...row,
                statuses: row.statuses.map((current) =>
                  current.statusId === status.statusId
                    ? { ...current, remainingOwnerTurnStarts: remaining }
                    : current,
                ),
              }
            : row,
        ),
      }
    }
  }
  return { state: nextState, events }
}

function resolveCurrentEndOfTurnDots(
  state: CombatEncounterState,
  combatantId: string,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  let nextState = state
  const events: CombatResolutionEvent[] = []

  const poison = currentPoisonInstance(nextState, combatantId)
  let target = getCombatant(nextState.tactical.battle, combatantId)
  if (poison?.skipCurrentOwnerTurnEnd)
    nextState = advanceCurrentPoisonEndTurn(nextState, combatantId)
  if (poison && !poison.skipCurrentOwnerTurnEnd && target.hp > 0) {
    const poisonDamage = currentPoisonEndTurnDamage(nextState, combatantId)
    const hpAfter = Math.max(0, target.hp - poisonDamage)
    nextState = withUpdatedCombatant(nextState, combatantId, { ...target, hp: hpAfter })
    nextState = advanceCurrentPoisonEndTurn(nextState, combatantId)
    events.push({
      event: 'damage_applied',
      actionId: 'status.poison.current.v1',
      sourceCombatantId: poison.sourceCombatantId,
      targetCombatantId: combatantId,
      amount: target.hp - hpAfter,
      hpBefore: target.hp,
      hpAfter,
    })
    if (hpAfter < target.hp) {
      const revealed = removeGameplayTags(
        nextState,
        poison.sourceCombatantId,
        combatantId,
        'status.poison.current.v1',
        ['Invisible'],
        content,
      )
      nextState = revealed.state
      events.push(...revealed.events)
    }
  }

  target = getCombatant(nextState.tactical.battle, combatantId)
  if (target.hp <= 0) return { state: nextState, events }

  const bleedTurn = advanceCurrentBleedEndTurn(nextState, combatantId)
  nextState = bleedTurn.state
  for (const stack of bleedTurn.stacks) {
    target = getCombatant(nextState.tactical.battle, combatantId)
    if (target.hp <= 0) break
    const hpAfter = Math.max(0, target.hp - stack.damagePerTick)
    nextState = withUpdatedCombatant(nextState, combatantId, { ...target, hp: hpAfter })
    events.push({
      event: 'damage_applied',
      actionId: stack.sourceActionId,
      sourceCombatantId: stack.sourceCombatantId,
      targetCombatantId: combatantId,
      amount: target.hp - hpAfter,
      hpBefore: target.hp,
      hpAfter,
    })
    if (hpAfter < target.hp) {
      const revealed = removeGameplayTags(
        nextState,
        stack.sourceCombatantId,
        combatantId,
        stack.sourceActionId,
        ['Invisible'],
        content,
      )
      nextState = revealed.state
      events.push(...revealed.events)
    }
  }

  target = getCombatant(nextState.tactical.battle, combatantId)
  if (target.hp <= 0) return { state: nextState, events }

  const burnTurn = advanceCurrentBurnEndTurn(nextState, combatantId)
  nextState = burnTurn.state
  if (burnTurn.instance && burnTurn.damage > 0) {
    target = getCombatant(nextState.tactical.battle, combatantId)
    const hpAfter = Math.max(0, target.hp - burnTurn.damage)
    nextState = withUpdatedCombatant(nextState, combatantId, { ...target, hp: hpAfter })
    events.push({
      event: 'damage_applied',
      actionId: 'status.burn.current.v1',
      sourceCombatantId: burnTurn.instance.sourceCombatantId,
      targetCombatantId: combatantId,
      amount: target.hp - hpAfter,
      hpBefore: target.hp,
      hpAfter,
    })
    if (hpAfter < target.hp) {
      const revealed = removeGameplayTags(
        nextState,
        burnTurn.instance.sourceCombatantId,
        combatantId,
        'status.burn.current.v1',
        ['Invisible'],
        content,
      )
      nextState = revealed.state
      events.push(...revealed.events)
    }
  }

  return { state: nextState, events }
}

function completeBattleIfResolved(state: CombatEncounterState): CombatResolutionTransition {
  if (state.tactical.battle.lifecycle !== 'active') {
    return { state, events: [] }
  }

  const activeTeams = new Set(
    state.tactical.battle.combatants
      .filter((combatant) => combatant.hp > 0)
      .map((combatant) => combatant.teamId),
  )
  if (activeTeams.size > 1) {
    return { state, events: [] }
  }

  const winningTeamId = [...activeTeams][0] ?? null
  const battle: BattleState = {
    ...state.tactical.battle,
    lifecycle: 'completed',
    currentTurn: null,
  }
  const nextState = withBattle(state, battle)
  return { state: nextState, events: [{ event: 'battle_completed', winningTeamId }] }
}

function withBattle(state: CombatEncounterState, battle: BattleState): CombatEncounterState {
  const tactical = createTacticalBattleState({ ...state.tactical, battle })
  const nextState = clearDefeatedRecovery({ ...state, tactical })
  assertValidCombatEncounterState(nextState)
  return nextState
}

function withUpdatedCombatant(
  state: CombatEncounterState,
  combatantId: string,
  combatant: BattleCombatant,
): CombatEncounterState {
  const battle: BattleState = {
    ...state.tactical.battle,
    combatants: state.tactical.battle.combatants.map((candidate) =>
      candidate.id === combatantId ? combatant : candidate,
    ),
  }

  if (
    battle.lifecycle === 'active' &&
    battle.currentTurn?.combatantId === combatantId &&
    combatant.hp <= 0
  ) {
    throw new Error('P2.3 does not permit the current actor to defeat itself during its Action.')
  }

  return withBattle(state, battle)
}

function resolveEffectRecipients(
  actorId: string,
  primaryCombatantId: string | null,
  affectedCombatantIds: readonly string[],
  recipient: CombatEffectRecipient,
): string[] {
  if (recipient === 'actor') return [actorId]
  if (recipient === 'primary-unit') return primaryCombatantId ? [primaryCombatantId] : []
  return [...affectedCombatantIds]
}

function hasStatus(state: CombatEncounterState, combatantId: string, statusId: string): boolean {
  return getStatus(state, combatantId, statusId) !== null
}

function getStatus(
  state: CombatEncounterState,
  combatantId: string,
  statusId: string,
  sourceCombatantId?: string,
): CombatStatusInstance | null {
  return (
    getStatusRow(state, combatantId).statuses.find(
      (status) =>
        status.statusId === statusId &&
        (status.sourceScopedMark !== true ||
          sourceCombatantId === undefined ||
          status.sourceCombatantId === sourceCombatantId),
    ) ?? null
  )
}

function getStatusRow(state: CombatEncounterState, combatantId: string): CombatantStatusState {
  const row = state.statusState.find((candidate) => candidate.combatantId === combatantId)
  if (!row) throw new Error(`Missing status state for combatant ${combatantId}.`)
  return row
}

function getStatusDefinitionById(
  content: CombatContentCatalog,
  statusId: string,
): CombatStatusDefinition {
  const definition = content.statuses.find((status) => status.id === statusId)
  if (!definition) throw new Error(`Unknown combat status definition ${statusId}.`)
  return definition
}

function getStatusDefinition(
  content: CombatContentCatalog,
  statusId: string,
  version: number,
): CombatStatusDefinition {
  const definition = getStatusDefinitionById(content, statusId)
  if (definition.version !== version) {
    throw new Error(`Combat status ${statusId} version does not match the pinned status instance.`)
  }
  return definition
}

function getCombatant(battle: BattleState, combatantId: string): BattleCombatant {
  const combatant = battle.combatants.find((candidate) => candidate.id === combatantId)
  if (!combatant) throw new Error(`Unknown combatant ${combatantId}.`)
  return combatant
}

function getPlacement(tactical: TacticalBattleState, combatantId: string): CombatPlacement {
  const placement = tactical.placements.find((candidate) => candidate.combatantId === combatantId)
  if (!placement) throw new Error(`Missing tactical placement for combatant ${combatantId}.`)
  return placement
}

function getTile(tactical: TacticalBattleState, position: GridPosition): CombatTile {
  const tile = tactical.tiles.find((candidate) => positionsEqual(candidate.position, position))
  if (!tile) throw new Error(`No tactical tile exists at ${position.x},${position.y}.`)
  return tile
}

function getOccupantId(tactical: TacticalBattleState, position: GridPosition): string | null {
  return (
    tactical.placements.find((placement) => positionsEqual(placement.position, position))
      ?.combatantId ?? null
  )
}

function isTeamPolicyAllowed(
  actor: BattleCombatant,
  target: BattleCombatant,
  policy: CombatTargetTeamPolicy,
): boolean {
  if (policy === 'any') return true
  if (policy === 'self') return actor.id === target.id
  if (policy === 'ally') return actor.teamId === target.teamId
  return actor.teamId !== target.teamId
}

function isFriendlyFireAllowed(
  actor: BattleCombatant,
  target: BattleCombatant,
  policy: CombatFriendlyFirePolicy,
): boolean {
  if (policy === 'all-units') return true
  if (policy === 'all-except-actor') return actor.id !== target.id
  if (policy === 'allies-only') return actor.teamId === target.teamId
  return actor.teamId !== target.teamId
}

function hasBaselineLineOfSight(
  state: CombatEncounterState,
  origin: GridPosition,
  target: GridPosition,
): boolean {
  const tactical = state.tactical
  const points = bresenhamLine(origin, target)
  for (let index = 1; index < points.length - 1; index += 1) {
    const tile = getTile(tactical, points[index])
    const terrain = tactical.terrains.find((candidate) => candidate.id === tile.terrainId)
    if (!terrain) throw new Error(`Unknown terrain ${tile.terrainId}.`)
    if (terrain.traversalCost === null || terrainOverlayAt(state, points[index])?.kind === 'steam')
      return false
  }
  return true
}

function bresenhamLine(origin: GridPosition, target: GridPosition): GridPosition[] {
  const points: GridPosition[] = []
  let x = origin.x
  let y = origin.y
  const dx = Math.abs(target.x - origin.x)
  const sx = origin.x < target.x ? 1 : -1
  const dy = -Math.abs(target.y - origin.y)
  const sy = origin.y < target.y ? 1 : -1
  let error = dx + dy

  while (true) {
    points.push({ x, y })
    if (x === target.x && y === target.y) break
    const doubled = error * 2
    if (doubled >= dy) {
      error += dy
      x += sx
    }
    if (doubled <= dx) {
      error += dx
      y += sy
    }
  }

  return points
}

function validateCombatActionDefinition(
  action: CombatActionDefinition,
  content?: CombatContentCatalog,
): void {
  validateCombatStatusCopyAction(action)
  validateGameplayActionMetadata(action)
  collectRequiredIdentity(action.id, 'action id')
  assertPositiveSafeInteger(action.version, 'action version')
  if (action.cooldown) {
    const cooldownIssues = validateSkillCooldownDefinition(action.cooldown)
    if (cooldownIssues.length > 0) {
      throw new TypeError(`Invalid action cooldown definition: ${cooldownIssues.join(', ')}.`)
    }
  }
  assertKnownString(
    action.sourceType,
    ['basic-attack', 'basic-action', 'discipline-skill', 'scenario', 'test'],
    'action source type',
  )
  assertKnownString(
    action.target.kind,
    ['self', 'unit', 'ground-tile', 'empty-tile'],
    'target kind',
  )
  assertKnownString(
    action.target.teamPolicy,
    ['self', 'ally', 'enemy', 'any'],
    'target team policy',
  )
  assertKnownString(
    action.target.friendlyFire,
    ['enemies-only', 'allies-only', 'all-units', 'all-except-actor'],
    'friendly-fire policy',
  )
  assertKnownString(action.target.shape.kind, ['single', 'circle', 'line'], 'target shape kind')
  assertBoolean(action.target.requiresLineOfSight, 'requiresLineOfSight')
  assertBoolean(action.cost.spendsAction, 'spendsAction')
  assertNonNegativeSafeInteger(action.target.minimumRange, 'minimum range')
  assertNonNegativeSafeInteger(action.target.maximumRange, 'maximum range')
  if (action.target.minimumRange > action.target.maximumRange) {
    throw new RangeError('Action minimum range cannot exceed maximum range.')
  }
  if (action.target.maximumElevationDifference !== null) {
    assertNonNegativeSafeInteger(
      action.target.maximumElevationDifference,
      'maximum elevation difference',
    )
  }
  if (action.target.shape.kind === 'circle') {
    assertNonNegativeSafeInteger(action.target.shape.radius, 'circle radius')
  }
  if (action.target.shape.kind === 'line') {
    assertPositiveSafeInteger(action.target.shape.length, 'line length')
  }
  assertNonNegativeSafeInteger(action.cost.mp, 'MP cost')

  if (action.effectTimingTags !== undefined) {
    if (
      !Array.isArray(action.effectTimingTags) ||
      action.effectTimingTags.length !== action.effects.length ||
      action.effectTimingTags.some(
        (tag) => tag !== undefined && !COMBAT_EFFECT_TIMING_TAGS.includes(tag),
      )
    )
      throw new TypeError('Internal effect timing tags must align with registered effects.')
  }
  if (action.effectOrigins !== undefined) {
    if (
      !Array.isArray(action.effectOrigins) ||
      action.effectOrigins.length !== action.effects.length
    )
      throw new TypeError('Effect origins must align with the effect list.')
    for (const origin of action.effectOrigins) {
      if (!origin) continue
      if (
        !['skill', 'essence', 'resonance', 'basic'].includes(origin.family) ||
        typeof origin.contentId !== 'string' ||
        !origin.contentId.trim() ||
        origin.contentId !== origin.contentId.trim() ||
        !Number.isSafeInteger(origin.contentVersion) ||
        origin.contentVersion < 1
      )
        throw new TypeError('Invalid pinned effect origin.')
    }
  }
  const tagSet = new Set<string>()
  for (const tag of action.tags) {
    collectRequiredIdentity(tag, 'action tag')
    if (tagSet.has(tag)) throw new Error(`Duplicate action tag ${tag}.`)
    tagSet.add(tag)
  }

  for (const requirement of action.requirements) {
    assertKnownString(
      requirement.kind,
      [
        'actor-status-present',
        'actor-status-absent',
        'target-status-present',
        'actor-hp-at-most',
        'actor-tag-present',
        'actor-tag-absent',
        'target-tag-present',
      ],
      'requirement kind',
    )
    if ('statusId' in requirement)
      collectRequiredIdentity(requirement.statusId, 'requirement status ID')
    if (requirement.kind === 'actor-hp-at-most') {
      assertBasisPoints(requirement.basisPoints, 'actor HP threshold')
    }
  }

  for (const effect of action.effects) {
    validateRecoveryEffect(effect)
    validateBarrierEffect(effect)
    assertKnownString(
      effect.type,
      [
        'damage',
        'healing',
        'resource-change',
        'apply-status',
        'remove-status',
        'return-to-turn-start',
        'create-terrain',
        'displace',
        'poison',
        'bleed',
        'burn',
        'barrier-change',
        'copy-statuses',
        'copy',
      ],
      'effect type',
    )
    if (effect.type === 'create-terrain') {
      continue
    }
    if (effect.type === 'copy') {
      if (effect.recipient !== 'primary-unit') {
        throw new TypeError('Copy requires the selected primary unit.')
      }
      continue
    }
    if (effect.type === 'displace') {
      if (content) getStatusDefinitionById(content, 'displaced')
    }
    assertKnownString(
      effect.recipient,
      ['actor', 'primary-unit', 'affected-units'],
      'effect recipient',
    )
    if (effect.type === 'damage' || effect.type === 'healing') {
      assertNonNegativeSafeInteger(effect.amount, `${effect.type} amount`)
    }
    if (effect.type === 'poison') validateCurrentPoisonEffect(effect)
    if (effect.type === 'burn') validateCurrentBurnEffect(effect)
    if (effect.type === 'bleed') validateCurrentBleedEffect(effect)
    if (effect.type === 'damage' && effect.defenseKind !== undefined)
      assertKnownString(effect.defenseKind, ['armor', 'ward'], 'damage defense kind')
    if (effect.type === 'damage' && effect.facingModifiersBasisPoints) {
      // Historical Perfect Opening v1 authors 220%; Skill facing is separate from basic/conditional caps.
      assertBasisPoints(effect.facingModifiersBasisPoints.front, 'front damage modifier', 22_000)
      assertBasisPoints(effect.facingModifiersBasisPoints.side, 'side damage modifier', 22_000)
      assertBasisPoints(effect.facingModifiersBasisPoints.rear, 'rear damage modifier', 22_000)
    }
    if (effect.type === 'resource-change') {
      assertKnownString(effect.resource, ['mp'], 'effect resource')
      if (!Number.isSafeInteger(effect.delta)) {
        throw new RangeError('Resource delta must be a safe integer.')
      }
    }
    if (effect.type === 'remove-status') {
      if (
        !Array.isArray(effect.statusIds) ||
        effect.statusIds.length < 1 ||
        effect.statusIds.length > 16 ||
        new Set(effect.statusIds).size !== effect.statusIds.length
      )
        throw new TypeError('Status removal requires one to sixteen distinct IDs.')
      for (const id of effect.statusIds) {
        collectRequiredIdentity(id, 'removed status ID')
        if (content) getStatusDefinitionById(content, id)
      }
    }
    if (
      effect.type === 'return-to-turn-start' &&
      (effect.recipient !== 'actor' || action.target.kind !== 'self')
    )
      throw new TypeError('Rewind is a self-only effect.')
    if (effect.type === 'apply-status') {
      collectRequiredIdentity(effect.statusId, 'effect status ID')
      assertPositiveSafeInteger(effect.stacks, 'effect status stacks')
      if (content) getStatusDefinitionById(content, effect.statusId)
    }
  }
}

function validateAttackProfile(profile: CombatAttackProfile): void {
  collectRequiredIdentity(profile.id, 'attack profile id')
  assertPositiveSafeInteger(profile.version, 'attack profile version')
  assertNonNegativeSafeInteger(profile.damage, 'attack profile damage')
  assertNonNegativeSafeInteger(profile.minimumRange, 'attack profile minimum range')
  assertNonNegativeSafeInteger(profile.maximumRange, 'attack profile maximum range')
  if (profile.minimumRange > profile.maximumRange) {
    throw new RangeError('Attack profile minimum range cannot exceed maximum range.')
  }
  if (profile.maximumElevationDifference !== null) {
    assertNonNegativeSafeInteger(
      profile.maximumElevationDifference,
      'attack profile maximum elevation difference',
    )
  }
  assertBasisPoints(profile.facingModifiersBasisPoints.front, 'front damage modifier', 20_000)
  assertBasisPoints(profile.facingModifiersBasisPoints.side, 'side damage modifier', 20_000)
  assertBasisPoints(profile.facingModifiersBasisPoints.rear, 'rear damage modifier', 20_000)
}

function validateCombatContentCatalog(content: CombatContentCatalog): void {
  const ids = new Set<string>()
  for (const status of content.statuses) {
    validateCombatAccuracyStatusDefinition(status)
    collectRequiredIdentity(status.id, 'status id')
    assertPositiveSafeInteger(status.version, 'status version')
    assertPositiveSafeInteger(status.maximumStacks, 'status maximum stacks')
    assertPositiveSafeInteger(status.durationOwnerTurnStarts, 'status duration')
    assertBasisPoints(status.damageTakenMultiplierBasisPoints, 'damage taken multiplier', 25_000)
    validateDamageModifiers(status.damageModifiers)
    if (status.gameplayTags !== undefined) {
      if (
        !Array.isArray(status.gameplayTags) ||
        status.gameplayTags.length > 16 ||
        new Set(status.gameplayTags).size !== status.gameplayTags.length
      )
        throw new TypeError('Invalid gameplay tags.')
      for (const tag of status.gameplayTags) validateGameplayTag(tag)
    }
    if (status.damageModifiers?.length && status.maximumStacks !== 1)
      throw new TypeError('Conditional damage statuses must be single-stack.')
    if (
      status.nextRoundInitiative !== undefined &&
      (!Number.isSafeInteger(status.nextRoundInitiative) ||
        Math.abs(status.nextRoundInitiative) > 40 ||
        status.nextRoundInitiative === 0 ||
        status.maximumStacks !== 1 ||
        status.endOfTurn)
    )
      throw new RangeError(
        'Round initiative status must be single-stack, non-periodic and bounded to +/-40.',
      )
    if (status.endOfTurn) {
      assertKnownString(status.endOfTurn.type, ['damage', 'healing'], 'periodic effect')
      assertPositiveSafeInteger(status.endOfTurn.amount, 'periodic amount')
      if (status.endOfTurn.amount > 100 || status.maximumStacks > 3)
        throw new RangeError('Periodic status exceeds its bounded magnitude.')
    }
    if (status.movement) {
      if (status.movement.blocked !== undefined && typeof status.movement.blocked !== 'boolean')
        throw new TypeError('Invalid movement restriction.')
      const ap = status.movement.additionalApPerTile ?? 0
      if (!Number.isSafeInteger(ap) || ap < -10 || ap > 20)
        throw new RangeError('Movement AP modifier must be between -10 and 20 AP per tile.')
    }
    if (ids.has(status.id)) throw new Error(`Duplicate combat status definition ${status.id}.`)
    ids.add(status.id)
  }
}

function emptyEvaluation(
  action: CombatActionDefinition,
  actorId: string | null,
  issues: readonly CombatActionIssue[],
): CombatActionEvaluation {
  return {
    legal: false,
    actionId: action.id,
    actorId,
    primaryPosition: null,
    primaryCombatantId: null,
    affectedTiles: [],
    affectedCombatantIds: [],
    projectedEffects: [],
    projectedTerrain: [],
    projectedEvents: [],
    mpCost: action.cost.mp,
    spendsAction: action.cost.spendsAction,
    issues,
  }
}

function scaleByBasisPoints(value: number, basisPoints: number): number {
  assertNonNegativeSafeInteger(value, 'combat value')
  assertNonNegativeSafeInteger(basisPoints, 'combat basis points')
  const scaled = (BigInt(value) * BigInt(basisPoints)) / BigInt(COMBAT_BASIS_POINTS)
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Scaled combat value exceeds the safe integer range.')
  }
  return Number(scaled)
}

function scaleRatioToBasisPoints(current: number, maximum: number): number {
  assertNonNegativeSafeInteger(current, 'ratio current')
  assertPositiveSafeInteger(maximum, 'ratio maximum')
  if (current > maximum) {
    throw new RangeError('Ratio current cannot exceed its maximum.')
  }
  const scaled = (BigInt(current) * BigInt(COMBAT_BASIS_POINTS)) / BigInt(maximum)
  return Number(scaled)
}

function addClampedSafeInteger(
  current: number,
  delta: number,
  minimum: number,
  maximum: number,
): number {
  if (
    !Number.isSafeInteger(current) ||
    !Number.isSafeInteger(delta) ||
    !Number.isSafeInteger(minimum) ||
    !Number.isSafeInteger(maximum) ||
    minimum > maximum
  ) {
    throw new RangeError('Combat resource arithmetic requires safe integer bounds and values.')
  }

  const candidate = BigInt(current) + BigInt(delta)
  const lower = BigInt(minimum)
  const upper = BigInt(maximum)
  if (candidate < lower) return minimum
  if (candidate > upper) return maximum
  return Number(candidate)
}

function manhattanDistance(left: GridPosition, right: GridPosition): number {
  const distance = Math.abs(left.x - right.x) + Math.abs(left.y - right.y)
  if (!Number.isSafeInteger(distance)) {
    throw new RangeError('Combat target distance exceeds the safe integer range.')
  }
  return distance
}

function positionsEqual(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y
}

function isWithinBoard(tactical: TacticalBattleState, position: GridPosition): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < tactical.width &&
    position.y < tactical.height
  )
}

function assertValidCombatEncounterState(state: CombatEncounterState): void {
  const issues = validateCombatEncounterState(state)
  if (issues.length > 0) {
    throw new Error(`Invalid combat encounter state: ${issues[0].field}: ${issues[0].message}`)
  }
}

function assertValidCombatEncounterStateForTurnEnd(
  state: CombatEncounterState,
  outgoingDefeatedAtTurnEnd: boolean,
): void {
  if (!outgoingDefeatedAtTurnEnd) {
    assertValidCombatEncounterState(state)
    return
  }

  const currentId = state.tactical.battle.currentTurn?.combatantId ?? null
  const current = currentId
    ? (state.tactical.battle.combatants.find((combatant) => combatant.id === currentId) ?? null)
    : null
  const allowDefeatedCurrent = current !== null && current.hp <= 0
  const issues = validateCombatEncounterState(state).filter(
    (issue) =>
      !(
        allowDefeatedCurrent &&
        issue.field === 'tactical.battle.currentTurn.combatantId' &&
        issue.message === 'A defeated combatant cannot own the current turn.'
      ),
  )
  if (issues.length > 0) {
    throw new Error(`Invalid combat encounter state: ${issues[0]!.field}: ${issues[0]!.message}`)
  }
}

function assertGridPosition(position: GridPosition, field: string): void {
  if (!Number.isSafeInteger(position.x) || !Number.isSafeInteger(position.y)) {
    throw new RangeError(`${field} must contain safe integer coordinates.`)
  }
}

function collectIdentityIssue(issues: CombatEncounterIssue[], value: string, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    issues.push({ field, message: 'Identity must be a non-empty trimmed string.' })
  }
}

function collectPositiveIntegerIssue(
  issues: CombatEncounterIssue[],
  value: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    issues.push({ field, message: 'Value must be a positive safe integer.' })
  }
}

function collectRequiredIdentity(value: string, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${field} must be a non-empty trimmed string.`)
  }
}

function assertKnownString(value: unknown, allowed: readonly string[], field: string): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new TypeError(`${field} is not supported.`)
  }
}

function assertBoolean(value: unknown, field: string): void {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${field} must be a boolean.`)
  }
}

function assertPositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive safe integer.`)
  }
}

function assertNonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer.`)
  }
}

function assertBasisPoints(
  value: number,
  field: string,
  maximum: number = COMBAT_BASIS_POINTS,
): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(`${field} must be an integer between 0 and ${maximum}.`)
  }
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function compareStableString(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y
}

function incomingHealingAmount(
  state: CombatEncounterState,
  recipientId: string,
  amount: number,
  content: CombatContentCatalog,
): number {
  const hexed = getStatusRow(state, recipientId).statuses.find((status) =>
    getStatusDefinition(content, status.statusId, status.statusVersion).gameplayTags?.includes(
      'Hexed',
    ),
  )
  if (!hexed) return amount
  return scaleByBasisPoints(amount, Math.max(0, 10_000 - (hexed.potencyBasisPoints ?? 2_500)))
}

function applyDisplacement(
  state: CombatEncounterState,
  actorId: string,
  recipientId: string,
  actionId: string,
  effect: Extract<CombatEffectDefinition, { type: 'displace' }>,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  const source = getPlacement(state.tactical, actorId).position
  const placement = getPlacement(state.tactical, recipientId)
  const from = { ...placement.position }
  const dx = from.x - source.x
  const dy = from.y - source.y
  const profile = state.tactical.movementProfiles.find(
    (row) => row.id === placement.movementProfileId,
  )!

  let initialFailure: DisplacementFailureReason | null = null
  if (getCombatant(state.tactical.battle, recipientId).hp <= 0) initialFailure = 'target-defeated'
  else if (
    getStatusRow(state, recipientId).statuses.some(
      (status) =>
        getStatusDefinition(content, status.statusId, status.statusVersion).movement?.blocked,
    )
  )
    initialFailure = 'status-restricted'
  else if (!dx && !dy) initialFailure = 'direction-undefined'

  if (initialFailure) {
    return {
      state,
      events: [
        {
          event: 'displacement_failed',
          ...(effect.direction ? { direction: effect.direction } : {}),
          actionId,
          sourceCombatantId: actorId,
          combatantId: recipientId,
          reason: initialFailure,
          position: { ...from },
        },
      ],
    }
  }

  const directionMultiplier = effect.direction === 'pull' ? -1 : 1

  let nextState = state
  let current = { ...from }
  let stopReason: DisplacementFailureReason | null = null
  let movedTiles = 0
  const movementEffectEvents: CombatResolutionEvent[] = []

  for (let index = 0; index < effect.distance; index += 1) {
    // Pull follows the caster at each step, rather than overshooting along its original axis.
    // Push keeps the same result as the legacy rule; ties always resolve horizontally.
    const dx = current.x - source.x
    const dy = current.y - source.y
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    const to = {
      x: current.x + (horizontal ? Math.sign(dx) * directionMultiplier : 0),
      y: current.y + (horizontal ? 0 : Math.sign(dy) * directionMultiplier),
    }
    const tile = nextState.tactical.tiles.find((candidate) => samePosition(candidate.position, to))
    const override =
      tile && profile.terrainCostOverrides.find((row) => row.terrainId === tile.terrainId)
    const terrainCost = tile
      ? override
        ? override.traversalCost
        : nextState.tactical.terrains.find((row) => row.id === tile.terrainId)?.traversalCost
      : null

    if (effect.direction === 'pull' && samePosition(to, source)) stopReason = 'occupied-tile'
    else if (!tile) stopReason = 'out-of-bounds'
    else if (terrainCost == null) stopReason = 'blocked-terrain'
    else if (
      nextState.tactical.placements.some(
        (unit) => unit.combatantId !== recipientId && samePosition(unit.position, to),
      )
    )
      stopReason = 'occupied-tile'
    else if (
      Math.abs(tile.elevation - getTile(nextState.tactical, current).elevation) >
      profile.maxElevationStep
    )
      stopReason = 'elevation-step-too-high'

    if (stopReason) break

    nextState = {
      ...nextState,
      tactical: {
        ...nextState.tactical,
        placements: nextState.tactical.placements.map((unit) =>
          unit.combatantId === recipientId ? { ...unit, position: to } : unit,
        ),
      },
    }
    current = to
    movedTiles += 1

    const movementEffects = resolveCombatMovementStepEffects(nextState, recipientId, content)
    nextState = movementEffects.state
    movementEffectEvents.push(...movementEffects.events)
    if (getCombatant(nextState.tactical.battle, recipientId).hp <= 0) {
      stopReason = 'target-defeated'
      break
    }
  }

  if (movedTiles === 0) {
    return {
      state,
      events: [
        {
          event: 'displacement_failed',
          ...(effect.direction ? { direction: effect.direction } : {}),
          actionId,
          sourceCombatantId: actorId,
          combatantId: recipientId,
          reason: stopReason ?? 'direction-undefined',
          position: { ...from },
        },
      ],
    }
  }

  const marked = applyEffect(
    nextState,
    actorId,
    recipientId,
    actionId,
    { type: 'apply-status', recipient: 'primary-unit', statusId: 'displaced', stacks: 1 },
    content,
    new Set(),
    false,
  )
  return {
    state: marked.state,
    events: [
      {
        event: 'combatant_displaced',
        ...(effect.direction ? { direction: effect.direction, distance: movedTiles } : {}),
        actionId,
        sourceCombatantId: actorId,
        combatantId: recipientId,
        from,
        to: { ...current },
      },
      ...movementEffectEvents,
      ...marked.events,
    ],
  }
}

export function resolveCombatMovementStepEffects(
  state: CombatEncounterState,
  combatantId: string,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  const poison = currentPoisonInstance(state, combatantId)
  const advanced = advanceCurrentPoisonMovement(state, combatantId, 1)
  if (!poison || advanced.triggeredTicks === 0) return { state: advanced.state, events: [] }

  let nextState = advanced.state
  const events: CombatResolutionEvent[] = []
  for (let index = 0; index < advanced.triggeredTicks; index += 1) {
    const target = getCombatant(nextState.tactical.battle, combatantId)
    if (target.hp <= 0) break
    const hpAfter = Math.max(0, target.hp - currentPoisonEndTurnDamage(nextState, combatantId))
    const defeatsCurrentActor =
      hpAfter === 0 &&
      nextState.tactical.battle.lifecycle === 'active' &&
      nextState.tactical.battle.currentTurn?.combatantId === combatantId
    const defeatTransition = defeatsCurrentActor
      ? defeatCurrentCombatant(nextState.tactical.battle, combatantId)
      : null
    nextState = defeatTransition
      ? withBattle(nextState, defeatTransition.state)
      : withUpdatedCombatant(nextState, combatantId, { ...target, hp: hpAfter })
    events.push({
      event: 'damage_applied',
      actionId: 'status.poison.current.v1',
      sourceCombatantId: poison.sourceCombatantId,
      targetCombatantId: combatantId,
      amount: target.hp - hpAfter,
      hpBefore: target.hp,
      hpAfter,
    })

    if (hpAfter < target.hp) {
      const revealed = removeGameplayTags(
        nextState,
        poison.sourceCombatantId,
        combatantId,
        'status.poison.current.v1',
        ['Invisible'],
        content,
      )
      nextState = revealed.state
      events.push(...revealed.events)
    }
    if (defeatTransition) events.push(...defeatTransition.events)
  }
  return { state: nextState, events }
}

function scheduleAfterRecovery(
  transition: CombatResolutionTransition,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
  kind: 'hp' | 'mp',
  amountPerTick: number,
  ticks: number,
): CombatResolutionTransition {
  const recovery = {
    sourceCombatantId,
    targetCombatantId,
    sourceActionId,
    kind,
    amountPerTick,
    remainingFutureTicks: ticks - 1,
    ...(transition.state.tactical.battle.currentTurn?.combatantId === targetCombatantId
      ? { skipCurrentOwnerTurnEnd: true }
      : {}),
  }
  const state = replaceRecoverySchedule(transition.state, recovery)
  if (state === transition.state) return transition
  return {
    state,
    events: [
      ...transition.events,
      {
        event: 'recovery_scheduled',
        actionId: sourceActionId,
        sourceCombatantId,
        targetCombatantId,
        resource: kind,
        amountPerTick,
        remainingFutureTicks: recovery.remainingFutureTicks,
      },
    ],
  }
}

function resolveEndOfTurnRecovery(
  state: CombatEncounterState,
  combatantId: string,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  let nextState = clearDefeatedRecovery(state)
  const events: CombatResolutionEvent[] = []
  const schedules =
    nextState.effectState?.ongoingRecovery.filter((row) => row.targetCombatantId === combatantId) ??
    []
  for (const schedule of schedules) {
    if (getCombatant(nextState.tactical.battle, combatantId).hp <= 0) break
    if (schedule.skipCurrentOwnerTurnEnd === true) {
      nextState = replaceRecoverySchedule(nextState, {
        ...schedule,
        skipCurrentOwnerTurnEnd: false,
      })
      continue
    }
    const effect: Extract<CombatEffectDefinition, { type: 'healing' | 'resource-change' }> =
      schedule.kind === 'hp'
        ? { type: 'healing', recipient: 'primary-unit', amount: schedule.amountPerTick }
        : {
            type: 'resource-change',
            recipient: 'primary-unit',
            resource: 'mp',
            delta: schedule.amountPerTick,
          }
    const tick = applyImmediateRecovery(
      nextState,
      schedule.sourceCombatantId,
      combatantId,
      schedule.sourceActionId,
      effect,
      content,
    )
    nextState = replaceRecoverySchedule(tick.state, {
      ...schedule,
      remainingFutureTicks: schedule.remainingFutureTicks - 1,
    })
    events.push(...tick.events)
  }
  return { state: nextState, events }
}

/** Casts and later recovery ticks share caps and Hex handling, but only casts schedule. */
function applyImmediateRecovery(
  state: CombatEncounterState,
  actorId: string,
  recipientId: string,
  actionId: string,
  effect: Extract<CombatEffectDefinition, { type: 'healing' | 'resource-change' }>,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  const target = getCombatant(state.tactical.battle, recipientId)
  if (effect.type === 'healing') {
    const hpAfter =
      target.hp <= 0
        ? target.hp
        : addClampedSafeInteger(
            target.hp,
            incomingHealingAmount(state, recipientId, effect.amount, content),
            0,
            target.maxHp,
          )
    return {
      state: withUpdatedCombatant(state, recipientId, { ...target, hp: hpAfter }),
      events: [
        {
          event: 'healing_applied',
          actionId,
          sourceCombatantId: actorId,
          targetCombatantId: recipientId,
          amount: hpAfter - target.hp,
          hpBefore: target.hp,
          hpAfter,
        },
      ],
    }
  }
  const mpAfter = addClampedSafeInteger(target.mp, effect.delta, 0, target.maxMp)
  return {
    state: withUpdatedCombatant(state, recipientId, { ...target, mp: mpAfter }),
    events: [
      {
        event: 'resource_changed',
        actionId,
        sourceCombatantId: actorId,
        targetCombatantId: recipientId,
        resource: 'mp',
        delta: mpAfter - target.mp,
        before: target.mp,
        after: mpAfter,
      },
    ],
  }
}

function expireOwnerTurnEndStatuses(
  state: CombatEncounterState,
  combatantId: string,
): CombatResolutionTransition {
  const events: CombatResolutionEvent[] = []
  return {
    state: {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId !== combatantId
          ? row
          : {
              ...row,
              statuses: row.statuses.flatMap((status) => {
                if (status.remainingOwnerTurnEnds === undefined) return [status]
                if (status.skipCurrentOwnerTurnEnd)
                  return [{ ...status, skipCurrentOwnerTurnEnd: undefined }]
                const remaining = status.remainingOwnerTurnEnds - 1
                if (remaining > 0)
                  return [
                    {
                      ...status,
                      remainingOwnerTurnEnds: remaining,
                      remainingOwnerTurnStarts: remaining,
                    },
                  ]
                events.push({
                  event: 'status_expired',
                  combatantId,
                  statusId: status.statusId,
                  ...(status.sourceScopedMark
                    ? { sourceCombatantId: status.sourceCombatantId }
                    : {}),
                })
                return []
              }),
            },
      ),
    },
    events,
  }
}

function preparePendingSummonsForRound(
  state: CombatEncounterState,
  nextRound: number,
): CombatResolutionTransition {
  if (nextRound <= state.tactical.battle.round || !state.pendingSummons?.length)
    return { state, events: [] }
  let next: CombatEncounterState = {
    ...state,
    pendingSummons: state.pendingSummons.filter((row) => row.activationRound > nextRound),
  }
  const events: CombatResolutionEvent[] = []
  const spawnedIds = new Set<string>()
  for (const pending of state.pendingSummons.filter((row) => row.activationRound <= nextRound)) {
    const owner = next.tactical.battle.combatants.find(
      (unit) => unit.id === pending.input.ownerCombatantId,
    )
    const occupied = next.tactical.placements.some(
      (row) =>
        row.position.x === pending.input.position.x && row.position.y === pending.input.position.y,
    )
    if (!owner || owner.hp <= 0 || occupied) continue
    const spawned = spawnCombatSummon(next as StatDrivenCombatEncounterState, pending.input)
    next = spawned.state
    for (const event of spawned.events)
      if (event.event === 'summon_spawned') spawnedIds.add(event.combatantId)
    events.push(
      ...spawned.events.map((event) =>
        pending.sourceCommandVisibility
          ? { ...event, sourceCommandVisibility: pending.sourceCommandVisibility }
          : event,
      ),
    )
  }
  if (spawnedIds.size) {
    const effectState = normalizeCombatEffectState(next.effectState)
    next = {
      ...next,
      effectState: {
        ...effectState,
        summons: effectState.summons?.map((row) =>
          spawnedIds.has(row.combatantId) ? { ...row, spawnedRound: nextRound } : row,
        ),
      },
    }
  }
  return { state: next, events }
}

function captureStatusCopySource(
  state: CombatEncounterState,
  combatantId: string,
  beneficialPersistentEffects = false,
): NonNullable<PendingCombatEffect['copySource']> {
  const effects = normalizeCombatEffectState(state.effectState)
  return JSON.parse(
    JSON.stringify({
      combatantId,
      ...(beneficialPersistentEffects ? { beneficialPersistentEffects: true } : {}),
      statuses: getStatusRow(state, combatantId).statuses,
      effectState: {
        ...effects,
        poison: effects.poison.filter((row) => row.targetCombatantId === combatantId),
        burn: effects.burn.filter((row) => row.targetCombatantId === combatantId),
        bleed: effects.bleed.filter((row) => row.targetCombatantId === combatantId),
        ...(beneficialPersistentEffects
          ? {
              barriers: (effects.barriers ?? []).filter(
                (row) => row.targetCombatantId === combatantId,
              ),
              ongoingRecovery: effects.ongoingRecovery.filter(
                (row) => row.targetCombatantId === combatantId,
              ),
            }
          : {}),
      },
    }),
  ) as NonNullable<PendingCombatEffect['copySource']>
}
function withStatusCopySource(
  state: CombatEncounterState,
  source: NonNullable<PendingCombatEffect['copySource']>,
): CombatEncounterState {
  const effects = normalizeCombatEffectState(state.effectState)
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === source.combatantId ? { ...row, statuses: source.statuses } : row,
    ),
    effectState: {
      ...effects,
      ...(source.beneficialPersistentEffects === true
        ? {
            barriers: [
              ...(effects.barriers ?? []).filter(
                (row) => row.targetCombatantId !== source.combatantId,
              ),
              ...(source.effectState.barriers ?? []),
            ],
            ongoingRecovery: [
              ...effects.ongoingRecovery.filter(
                (row) => row.targetCombatantId !== source.combatantId,
              ),
              ...source.effectState.ongoingRecovery,
            ],
          }
        : {}),
      poison: [
        ...effects.poison.filter((row) => row.targetCombatantId !== source.combatantId),
        ...source.effectState.poison,
      ],
      burn: [
        ...effects.burn.filter((row) => row.targetCombatantId !== source.combatantId),
        ...source.effectState.burn,
      ],
      bleed: [
        ...effects.bleed.filter((row) => row.targetCombatantId !== source.combatantId),
        ...source.effectState.bleed,
      ],
    },
  }
}

function validateSourceCommandVisibility(
  state: CombatEncounterState,
  visibility: CombatSourceCommandVisibility | undefined,
  sourceId: string,
): void {
  if (visibility === undefined) return
  const source = state.tactical.battle.combatants.find((unit) => unit.id === sourceId)
  if (
    !visibility ||
    visibility.kind !== 'team-only' ||
    typeof visibility.teamId !== 'string' ||
    visibility.teamId !== source?.teamId ||
    Object.keys(visibility).some((key) => !['kind', 'teamId'].includes(key))
  )
    throw new TypeError('Invalid pinned source command visibility.')
}
