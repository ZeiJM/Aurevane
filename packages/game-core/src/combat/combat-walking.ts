import type {
  CombatContentCatalog,
  CombatEncounterState,
  CombatResolutionEvent,
  CombatResolutionTransition,
} from './actions-legacy'
import { createCombatEncounterState, resolveCombatMovementStepEffects } from './actions-legacy'
import { airborneMovementTactical } from './combat-airborne'
import {
  consumeCommittedCombatMovement,
  type CommittedCombatExecution,
} from './combat-committed-execution'
import {
  observeCombatNativeMutation,
  type CombatNativeExecutionHooks,
} from './combat-native-mutations'
import { advanceCurrentPoisonMovement, currentPoisonTickDamage } from './combat-dots'
import { hasGameplayTag } from './gameplay-tags'
import { terrainOverlayAt, COMBAT_TERRAIN_OVERLAY_DETAILS } from './terrain-overlays'
import {
  evaluateCurrentMovementPath,
  movementTraversalCostAt,
  moveCurrentCombatant,
  type GridPosition,
} from './board'
import { movementApCostForTile, PV1F_LAST_MATURE_SKILL_RESOURCE_PREFIX } from './pv1f-skills'
import { PV1F_ACTION_ECONOMY_RESOURCE_KEY } from './pv1f-turn-preparation'
import {
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

/** Shared by authoritative movement and board highlights; does not spend resources. */
export function combatWalkingModifiers(
  state: Pick<
    StatDrivenCombatEncounterState,
    'statusState' | 'terrainOverlays' | 'effectStackingPolicyVersion' | 'frozenGroundPolicyVersion'
  > & {
    tactical: {
      battle: Pick<
        StatDrivenCombatEncounterState['tactical']['battle'],
        'currentTurn' | 'combatants'
      >
    }
  },
  content: CombatContentCatalog,
) {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  const statuses = (
    state.statusState.find((row) => row.combatantId === actorId)?.statuses ?? []
  ).filter((status) => status.timingState !== 'pending')
  const definitions = statuses.map((status) =>
    content.statuses.find(
      (definition) =>
        definition.id === status.statusId && definition.version === status.statusVersion,
    ),
  )
  const rooted = definitions.some((definition) => definition?.movement?.blocked)
  const surcharge =
    state.effectStackingPolicyVersion === 1
      ? definitions.reduce(
          (sum, definition, index) =>
            sum +
            BigInt(definition?.movement?.additionalApPerTile ?? 0) *
              BigInt(statuses[index]!.stacks),
          0n,
        )
      : BigInt(
          Math.min(
            20,
            definitions.reduce(
              (sum, definition) => sum + (definition?.movement?.additionalApPerTile ?? 0),
              0,
            ),
          ),
        )
  const safeDelta = (value: bigint) => {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER))
      throw new RangeError('Combined movement effect modifier exceeds the safe integer range.')
    return Number(value)
  }
  safeDelta(surcharge)
  const airborne = Boolean(actorId && hasGameplayTag(state, actorId, 'Airborne', content))
  const actorTeam = state.tactical.battle.combatants.find((unit) => unit.id === actorId)?.teamId
  const frozenSurchargeApplies = (position: GridPosition) => {
    const overlay = terrainOverlayAt(state, position)
    if (airborne || overlay?.kind !== 'frozen') return false
    if (state.frozenGroundPolicyVersion !== 1) return true
    const sourceTeam = state.tactical.battle.combatants.find(
      (unit) => unit.id === overlay.sourceCombatantId,
    )?.teamId
    return actorTeam !== undefined && sourceTeam !== undefined && actorTeam !== sourceTeam
  }
  return {
    blocked: rooted,
    additionalApAt: (position: GridPosition) =>
      safeDelta(
        surcharge +
          BigInt(
            frozenSurchargeApplies(position)
              ? COMBAT_TERRAIN_OVERLAY_DETAILS.frozen.additionalApPerTile
              : 0,
          ),
      ),
  }
}

export interface Pv1fPoisonMovementForecast {
  traversedTiles: number
  triggeredTicks: number
  damage: number
  willDefeat: boolean
}

function forecastPv1fPoisonMovement(
  state: StatDrivenCombatEncounterState,
  path: readonly GridPosition[],
): Pv1fPoisonMovementForecast {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) return { traversedTiles: 0, triggeredTicks: 0, damage: 0, willDefeat: false }
  const actor = state.tactical.battle.combatants.find((unit) => unit.id === actorId)!
  let shadow = state as CombatEncounterState
  let hp = actor.hp
  let traversedTiles = 0
  let triggeredTicks = 0

  for (let index = 1; index < path.length; index += 1) {
    const advanced = advanceCurrentPoisonMovement(shadow, actorId, 1)
    shadow = advanced.state
    traversedTiles += 1
    triggeredTicks += advanced.triggeredTicks
    if (advanced.triggeredTicks > 0) {
      hp = Math.max(
        0,
        hp -
          advanced.ticks.reduce(
            (total, tick) => total + tick.triggeredTicks * currentPoisonTickDamage(tick.instance),
            0,
          ),
      )
      if (hp === 0) break
    }
  }

  return {
    traversedTiles,
    triggeredTicks,
    damage: actor.hp - hp,
    willDefeat: actor.hp > 0 && hp === 0,
  }
}

export interface Pv1fMovementQuoteOptions {
  readonly maximumTiles?: number
  /** Captured native Basic Move price; committed attached Move always costs zero here. */
  readonly apPerTraversalPoint?: number
  readonly ignorePoisonForecast?: boolean
}

export function evaluatePreparedCombatWalking(
  prepared: StatDrivenCombatEncounterState,
  path: readonly GridPosition[],
  content: CombatContentCatalog,
  options: Pv1fMovementQuoteOptions = {},
) {
  const movementTactical = airborneMovementTactical(prepared, content)
  let movement = evaluateCurrentMovementPath(
    movementTactical,
    path,
    'entered-tiles',
    prepared.statBalancePolicyVersion,
    prepared.airborneJumpPolicyVersion,
  )
  const modifiers = combatWalkingModifiers(prepared, content)
  if (options.maximumTiles !== undefined && path.length - 1 > options.maximumTiles) {
    movement.legal = false
    movement.issues = [
      ...movement.issues,
      {
        code: 'movement-budget-exceeded',
        stepIndex: null,
        message: 'Move exceeds its authored entered-tile cap.',
      },
    ]
  }
  if (modifiers.blocked) {
    movement.legal = false
    movement.issues = [
      ...movement.issues,
      {
        code: 'status-restricted',
        stepIndex: null,
        message: 'Root prevents movement until it expires or is cleansed.',
      },
    ]
  }

  const poisonForecast = movement.legal
    ? forecastPv1fPoisonMovement(prepared, path)
    : { traversedTiles: 0, triggeredTicks: 0, damage: 0, willDefeat: false }
  if (
    movement.legal &&
    !options.ignorePoisonForecast &&
    poisonForecast.traversedTiles < path.length - 1
  ) {
    movement = evaluateCurrentMovementPath(
      movementTactical,
      path.slice(0, poisonForecast.traversedTiles + 1),
      'entered-tiles',
      prepared.statBalancePolicyVersion,
      prepared.airborneJumpPolicyVersion,
    )
  }
  // Retain the terrain-weight preview contract, including a validated prefix of an illegal path.
  const terrainCost = movement.path.slice(1, movement.cost + 1).reduce((sum, position) => {
    const traversal = movementTraversalCostAt(prepared.tactical, movement.combatantId, position)
    if (traversal === null) throw new Error('Validated movement cannot enter blocked terrain.')
    return sum + traversal
  }, 0)
  const economyCost = movement.legal
    ? movement.path.slice(1).reduce((sum, position) => {
        const traversal = movementTraversalCostAt(prepared.tactical, movement.combatantId, position)
        if (traversal === null) throw new Error('Legal movement cannot enter blocked terrain.')
        return (
          sum +
          movementApCostForTile(
            traversal,
            modifiers.additionalApAt(position),
            options.apPerTraversalPoint,
          )
        )
      }, 0)
    : 0
  return { prepared, movement, terrainCost, economyCost, poisonForecast }
}

export interface CombatWalkingExecutionOptions {
  readonly maximumTiles?: number
  /** Captured native Basic Move price; committed attached Move always costs zero here. */
  readonly apPerTraversalPoint?: number
  readonly nativeHooks?: CombatNativeExecutionHooks
  readonly committed?: CommittedCombatExecution
  readonly actionId?: string
}
/** Single step authority shared by native Basic Move and an already paid canonical Move. */
export function executePreparedCombatWalking(
  prepared: StatDrivenCombatEncounterState,
  movementPath: readonly GridPosition[],
  content: CombatContentCatalog,
  options: CombatWalkingExecutionOptions = {},
): CombatResolutionTransition & { state: StatDrivenCombatEncounterState; spentEconomy: number } {
  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('PV-1F movement requires an active turn.')
  if (options.committed)
    consumeCommittedCombatMovement(options.committed, prepared, actorId, {
      path: movementPath,
      maximumTiles: options.maximumTiles!,
    })
  const nativeHooks = options.nativeHooks
  let next = prepared
  let spentEconomy = 0
  const movementEvents: CombatResolutionEvent[] = []
  const movementEffectEvents: CombatResolutionEvent[] = []
  for (let index = 1; index < movementPath.length; index += 1) {
    if (
      next.tactical.battle.lifecycle !== 'active' ||
      next.tactical.battle.currentTurn?.combatantId !== actorId ||
      (next.tactical.battle.combatants.find((unit) => unit.id === actorId)?.hp ?? 0) <= 0
    )
      break
    const modifiers = combatWalkingModifiers(next, content)
    if (modifiers.blocked || (options.maximumTiles !== undefined && index > options.maximumTiles))
      break
    const position = movementPath[index]!
    const traversal = movementTraversalCostAt(next.tactical, actorId, position)
    if (traversal === null) break
    const stepCost = options.committed
      ? 0
      : movementApCostForTile(
          traversal,
          modifiers.additionalApAt(position),
          options.apPerTraversalPoint,
        )
    if (
      !options.committed &&
      (next.tactical.battle.combatants
        .find((unit) => unit.id === actorId)
        ?.temporaryResources.find((resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY)
        ?.current ?? 0) <
        spentEconomy + stepCost
    )
      break
    if (
      !evaluateCurrentMovementPath(
        airborneMovementTactical(next, content),
        [movementPath[index - 1]!, position],
        'entered-tiles',
        next.statBalancePolicyVersion,
        next.airborneJumpPolicyVersion,
      ).legal
    )
      break
    const beforeStep = next
    const moved = moveCurrentCombatant(
      airborneMovementTactical(next, content),
      [movementPath[index - 1]!, position],
      'entered-tiles',
      next.statBalancePolicyVersion,
      next.airborneJumpPolicyVersion,
    )
    next = reattachStatDrivenCombatBridge(
      {
        ...next,
        ...createCombatEncounterState(
          {
            ...moved.state,
            battle: {
              ...moved.state.battle,
              ...(next.effectStackingPolicyVersion === 1
                ? { effectStackingPolicyVersion: 1 as const }
                : {}),
            },
            movementProfiles: next.tactical.movementProfiles,
          },
          next.statusState,
        ),
      },
      next.statBridge,
    )
    next = observeCombatNativeMutation(
      nativeHooks,
      beforeStep,
      { state: next, events: moved.events },
      {
        ...(options.committed
          ? {
              ...nativeHooks?.commandFacts?.(options.actionId!),
              actionId: options.actionId!,
            }
          : {}),
        triggeringCombatantId: actorId,
        affectedCombatantIds: [actorId],
      },
    ).state as typeof next
    spentEconomy += stepCost
    movementEvents.push(...moved.events)
    const resolved = resolveCombatMovementStepEffects(next, actorId, content, {
      nativeHooks,
      deferCompletion: Boolean(nativeHooks),
    })
    next = reattachStatDrivenCombatBridge(resolved.state, next.statBridge)
    movementEffectEvents.push(...resolved.events)
  }
  // One command retains one movement receipt, even though hazards resolve at each tile.
  const moves = movementEvents.filter(
    (event): event is Extract<CombatResolutionEvent, { event: 'combatant_moved' }> =>
      event.event === 'combatant_moved',
  )
  const movedEvents =
    moves.length === 0
      ? []
      : [
          {
            ...moves[0]!,
            to: moves.at(-1)!.to,
            movementCost: moves.reduce((sum, event) => sum + event.movementCost, 0),
          },
        ]
  const spends = movementEvents.filter(
    (event): event is Extract<CombatResolutionEvent, { event: 'movement_spent' }> =>
      event.event === 'movement_spent',
  )
  const spentEvents =
    spends.length === 0
      ? []
      : [{ ...spends.at(-1)!, amount: spends.reduce((sum, event) => sum + event.amount, 0) }]

  // The native facade clears history after paying, retaining its historical ordering.
  if (options.committed)
    next = {
      ...next,
      tactical: {
        ...next.tactical,
        battle: {
          ...next.tactical.battle,
          combatants: next.tactical.battle.combatants.map((unit) =>
            unit.id === actorId
              ? {
                  ...unit,
                  temporaryResources: unit.temporaryResources.filter(
                    (resource) => !resource.key.startsWith(PV1F_LAST_MATURE_SKILL_RESOURCE_PREFIX),
                  ),
                }
              : unit,
          ),
        },
      },
    }
  return {
    state: next,
    spentEconomy,
    events: [
      ...movementEvents.filter(
        (event) => event.event !== 'combatant_moved' && event.event !== 'movement_spent',
      ),
      ...spentEvents,
      ...movedEvents,
      ...movementEffectEvents,
    ],
  }
}
