import type { CombatActionEvaluation, CombatEncounterState, CombatTargetSelection } from './actions'
import type { GridPosition } from './board'
import { moveCurrentCombatant } from './board'
import { airborneMovementTactical } from './combat-airborne'
import type { AbilityEffect } from './combat-definition'
import type { CombatTagPayload } from './combat-tag-registry'
import { combatAbilitySubject } from './combat-behavior-runtime'
import { evaluateAbilitySelectedRequirements } from './combat-requirements'
import { evaluatePreparedCombatWalking } from './combat-walking'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

export type CombatMovePayload = Extract<CombatTagPayload, { type: 'move' }>
export interface PreparedCombatMove {
  readonly independentAllowance?: boolean
  readonly path: readonly GridPosition[]
  readonly eligible: boolean
  readonly maximumTiles: number
  /** Pure planned geometry only. Actual settlement always reads the reached live placement. */
  readonly projectedState: CombatEncounterState
  readonly issues: CombatActionEvaluation['issues']
}
type MoveInput = {
  state: CombatEncounterState
  content: import('./actions').CombatContentCatalog
  actorId: string
  selection: CombatTargetSelection
  movementPath?: readonly GridPosition[]
  independentAllowance?: boolean
}

export function prepareCombatMove(input: MoveInput, effect: AbilityEffect): PreparedCombatMove {
  if (effect.payload.type !== 'move') throw new TypeError('move-effect-required')
  const payload = effect.payload
  const invalid = (message: string): PreparedCombatMove => ({
    path: [],
    eligible: false,
    maximumTiles: payload.maximumTiles,
    projectedState: input.state,
    issues: [{ code: 'invalid-target-kind', message }],
  })
  if (!input.state.statBridge)
    return invalid('Move requires the supported stat-driven walking encounter.')
  const selected =
    input.selection.kind === 'selections' ? input.selection.selections : [input.selection]
  const subjects = selected.flatMap((choice) =>
    choice.kind === 'unit'
      ? [combatAbilitySubject(input.state, choice.combatantId)]
      : choice.kind === 'self'
        ? [combatAbilitySubject(input.state, input.actorId)]
        : [],
  )
  const eligible = evaluateAbilitySelectedRequirements(
    effect.requirements ?? null,
    {
      owner: combatAbilitySubject(input.state, input.actorId),
      affected: combatAbilitySubject(input.state, input.actorId),
    },
    subjects,
  )
  // An ineligible conditional effect has no walking intent. Do not require
  // invented coordinates; an explicit supplied path still validates below.
  if (input.movementPath === undefined && !eligible)
    return {
      path: [],
      eligible,
      maximumTiles: payload.maximumTiles,
      projectedState: input.state,
      issues: [],
    }
  const path = input.movementPath
  if (
    !Array.isArray(path) ||
    path.length < 2 ||
    path.length > 21 ||
    path.length - 1 > payload.maximumTiles
  )
    return invalid('Move requires an origin and one through the authored maximum entered tiles.')
  const origin = input.state.tactical.placements.find(
    (p) => p.combatantId === input.actorId,
  )?.position
  if (!origin || path[0]?.x !== origin.x || path[0]?.y !== origin.y)
    return invalid('Move path must begin at the authoritative actor position.')
  for (const [index, point] of path.entries()) {
    if (
      !point ||
      typeof point !== 'object' ||
      Object.keys(point).some((key) => key !== 'x' && key !== 'y') ||
      !Number.isSafeInteger(point.x) ||
      !Number.isSafeInteger(point.y) ||
      point.x < 0 ||
      point.y < 0 ||
      point.x >= input.state.tactical.width ||
      point.y >= input.state.tactical.height ||
      (index > 0 &&
        Math.abs(point.x - path[index - 1]!.x) + Math.abs(point.y - path[index - 1]!.y) !== 1)
    )
      return invalid('Move path contains an invalid or non-orthogonal Ground reference.')
  }
  const copy = path.map((point) => Object.freeze({ ...point }))
  if (!eligible)
    return {
      path: copy,
      eligible,
      maximumTiles: payload.maximumTiles,
      projectedState: input.state,
      issues: [],
    }
  const state = input.state as StatDrivenCombatEncounterState
  const quote = evaluatePreparedCombatWalking(state, copy, input.content, {
    independentAllowance: input.independentAllowance,
    maximumTiles: payload.maximumTiles,
    ignorePoisonForecast: true,
  })
  if (!quote.movement.legal)
    return invalid(quote.movement.issues[0]?.message ?? 'Move path is not legal.')
  const moved = moveCurrentCombatant(
    airborneMovementTactical(state, input.content),
    copy,
    input.independentAllowance ? 'skill-entered-tiles' : 'entered-tiles',
    state.statBalancePolicyVersion,
    state.airborneJumpPolicyVersion,
  )
  return {
    path: copy,
    independentAllowance: input.independentAllowance,
    eligible,
    maximumTiles: payload.maximumTiles,
    projectedState: {
      ...state,
      tactical: {
        ...state.tactical,
        ...moved.state,
        movementProfiles: state.tactical.movementProfiles,
      },
    },
    issues: [],
  }
}
