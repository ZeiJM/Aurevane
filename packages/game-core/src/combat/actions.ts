import type { SkillNarrationTemplate } from './battle-narration'
import { endTurn, spendAction, type BattleCombatant, type BattleState } from './battle-state'
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

export interface FacingDamageModifiers {
  front: number
  side: number
  rear: number
}

export type CombatEffectDefinition =
  | {
      type: 'damage'
      recipient: CombatEffectRecipient
      amount: number
      facingModifiersBasisPoints?: FacingDamageModifiers
    }
  | { type: 'healing'; recipient: CombatEffectRecipient; amount: number }
  | { type: 'resource-change'; recipient: CombatEffectRecipient; resource: 'mp'; delta: number }
  | {
      type: 'apply-status'
      recipient: CombatEffectRecipient
      statusId: string
      stacks: number
    }

export interface CombatActionDefinition {
  id: string
  version: number
  sourceType: CombatActionSourceType
  tags: readonly string[]
  target: CombatTargetSpec
  cost: CombatActionCost
  requirements: readonly CombatUseRequirement[]
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
}

export interface CombatContentCatalog {
  statuses: readonly CombatStatusDefinition[]
}

export interface CombatStatusInstance {
  statusId: string
  statusVersion: number
  stacks: number
  remainingOwnerTurnStarts: number
  sourceCombatantId: string
}

export interface CombatantStatusState {
  combatantId: string
  statuses: readonly CombatStatusInstance[]
}

export interface CombatEncounterState {
  schemaVersion: typeof COMBAT_ENCOUNTER_SCHEMA_VERSION
  tactical: TacticalBattleState
  statusState: readonly CombatantStatusState[]
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
  effectType: CombatEffectDefinition['type']
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
  mpCost: number
  spendsAction: boolean
  issues: readonly CombatActionIssue[]
}

export type CombatResolutionEvent =
  | TacticalBattleEvent
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
      actionId: string
      sourceCombatantId: string
      targetCombatantId: string
      statusId: string
      stacks: number
      remainingOwnerTurnStarts: number
      refreshed: boolean
      stacked: boolean
    }
  | { event: 'status_expired'; combatantId: string; statusId: string }
  | { event: 'combatant_waited'; combatantId: string }
  | { event: 'battle_completed'; winningTeamId: string | null }

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
        .sort((left, right) => compareStableString(left.statusId, right.statusId)),
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
  if (actor.mp < action.cost.mp) {
    issues.push({ code: 'insufficient-mp', message: 'The actor does not have enough MP.' })
  }

  const target = resolvePrimaryTarget(state, actorId, action.target, selection, issues)
  if (target.position) {
    collectSpatialTargetIssues(state, actorId, action.target, target.position, issues)
  }
  collectRequirementIssues(state, actorId, target.combatantId, action.requirements, issues)

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
    collectEffectRecipientIssues(action.effects, target.combatantId, affectedCombatantIds, issues)
  }

  let projectedEffects: CombatEffectProjection[] = []
  if (issues.length === 0) {
    const projectionState =
      action.cost.mp > 0
        ? withUpdatedCombatant(state, actorId, {
            ...actor,
            mp: actor.mp - action.cost.mp,
          })
        : state
    projectedEffects = projectEffects(
      projectionState,
      actorId,
      target.combatantId,
      affectedCombatantIds,
      action,
      content,
    )
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
    mpCost: action.cost.mp,
    spendsAction: action.cost.spendsAction,
    issues,
  }
}

export function executeCombatAction(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  content: CombatContentCatalog,
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
  let nextState = state
  const events: CombatResolutionEvent[] = []

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

  for (const effect of action.effects) {
    const recipients = resolveEffectRecipients(
      actorId,
      evaluation.primaryCombatantId,
      evaluation.affectedCombatantIds,
      effect.recipient,
    )

    for (const recipientId of recipients) {
      const applied = applyEffect(nextState, actorId, recipientId, action.id, effect, content)
      nextState = applied.state
      events.push(...applied.events)
    }
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

export function endCombatTurn(
  state: CombatEncounterState,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  assertValidCombatEncounterState(state)
  validateCombatContentCatalog(content)

  if (state.tactical.battle.lifecycle !== 'active') {
    throw new Error('End Turn requires an active battle.')
  }

  const ended = endTurn(state.tactical.battle)
  let nextState = withBattle(state, ended.state)
  const events: CombatResolutionEvent[] = [...ended.events]
  const nextActorId = ended.state.currentTurn?.combatantId

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
  const issues: CombatEncounterIssue[] = []

  if (state.schemaVersion !== COMBAT_ENCOUNTER_SCHEMA_VERSION) {
    issues.push({ field: 'schemaVersion', message: 'Unsupported combat-encounter schema version.' })
  }

  for (const issue of validateTacticalBattleState(state.tactical)) {
    issues.push({ field: `tactical.${issue.field}`, message: issue.message })
  }

  const expectedCombatantIds = [...state.tactical.battle.combatants]
    .map((combatant) => combatant.id)
    .sort(compareStableString)
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

    const statusIds = new Set<string>()
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
      if (!expectedCombatantIds.includes(status.sourceCombatantId)) {
        issues.push({
          field: `${statusPrefix}.sourceCombatantId`,
          message: 'Status source must reference a combatant in this encounter.',
        })
      }
      if (statusIds.has(status.statusId)) {
        issues.push({
          field: `${statusPrefix}.statusId`,
          message: 'A combatant cannot have duplicate status identities.',
        })
      }
      statusIds.add(status.statusId)
    }

    const sortedStatusIds = [...row.statuses]
      .map((status) => status.statusId)
      .sort(compareStableString)
    if (
      !arraysEqual(
        row.statuses.map((status) => status.statusId),
        sortedStatusIds,
      )
    ) {
      issues.push({
        field: `${prefix}.statuses`,
        message: 'Statuses must use stable status ID ordering.',
      })
    }
  }

  return issues
}

function resolvePrimaryTarget(
  state: CombatEncounterState,
  actorId: string,
  spec: CombatTargetSpec,
  selection: CombatTargetSelection,
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

  if (
    spec.requiresLineOfSight &&
    !hasBaselineLineOfSight(state.tactical, actorPosition, targetPosition)
  ) {
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
  issues: CombatActionIssue[],
): void {
  const actor = getCombatant(state.tactical.battle, actorId)

  for (const requirement of requirements) {
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
): void {
  for (const effect of effects) {
    if (effect.recipient === 'primary-unit' && !primaryCombatantId) {
      issues.push({
        code: 'effect-target-missing',
        message: 'An effect requires a primary unit target that is not available.',
      })
    }
    if (effect.recipient === 'affected-units' && affectedCombatantIds.length === 0) {
      issues.push({
        code: 'effect-target-missing',
        message: 'An area effect resolves to no affected combatants.',
      })
    }
  }
}

function projectEffects(
  state: CombatEncounterState,
  actorId: string,
  primaryCombatantId: string | null,
  affectedCombatantIds: readonly string[],
  action: CombatActionDefinition,
  content: CombatContentCatalog,
): CombatEffectProjection[] {
  let simulated = state
  const projections: CombatEffectProjection[] = []

  for (const effect of action.effects) {
    const recipients = resolveEffectRecipients(
      actorId,
      primaryCombatantId,
      affectedCombatantIds,
      effect.recipient,
    )
    for (const recipientId of recipients) {
      const projection = projectSingleEffect(simulated, actorId, recipientId, effect, content)
      projections.push(projection.projection)
      simulated = projection.state
    }
  }

  return projections
}

function projectSingleEffect(
  state: CombatEncounterState,
  actorId: string,
  recipientId: string,
  effect: CombatEffectDefinition,
  content: CombatContentCatalog,
): { state: CombatEncounterState; projection: CombatEffectProjection } {
  if (effect.type === 'damage') {
    const target = getCombatant(state.tactical.battle, recipientId)
    const amount = resolveDamageAmount(state, actorId, recipientId, effect, content)
    const nextHp = Math.max(0, target.hp - amount)
    return {
      state: withUpdatedCombatant(state, recipientId, { ...target, hp: nextHp }),
      projection: {
        effectType: 'damage',
        combatantId: recipientId,
        before: target.hp,
        after: nextHp,
      },
    }
  }

  if (effect.type === 'healing') {
    const target = getCombatant(state.tactical.battle, recipientId)
    const nextHp = addClampedSafeInteger(target.hp, effect.amount, 0, target.maxHp)
    return {
      state: withUpdatedCombatant(state, recipientId, { ...target, hp: nextHp }),
      projection: {
        effectType: 'healing',
        combatantId: recipientId,
        before: target.hp,
        after: nextHp,
      },
    }
  }

  if (effect.type === 'resource-change') {
    const target = getCombatant(state.tactical.battle, recipientId)
    const nextMp = addClampedSafeInteger(target.mp, effect.delta, 0, target.maxMp)
    return {
      state: withUpdatedCombatant(state, recipientId, { ...target, mp: nextMp }),
      projection: {
        effectType: 'resource-change',
        combatantId: recipientId,
        before: target.mp,
        after: nextMp,
      },
    }
  }

  const before = getStatus(state, recipientId, effect.statusId)
  const nextState = applyStatusState(
    state,
    actorId,
    recipientId,
    effect.statusId,
    effect.stacks,
    content,
  )
  const after = getStatus(nextState, recipientId, effect.statusId)
  return {
    state: nextState,
    projection: {
      effectType: 'apply-status',
      combatantId: recipientId,
      before: before ? `${before.statusId}:${before.stacks}` : 'none',
      after: after ? `${after.statusId}:${after.stacks}` : 'none',
    },
  }
}

function applyEffect(
  state: CombatEncounterState,
  actorId: string,
  recipientId: string,
  actionId: string,
  effect: CombatEffectDefinition,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  if (effect.type === 'damage') {
    const target = getCombatant(state.tactical.battle, recipientId)
    const amount = resolveDamageAmount(state, actorId, recipientId, effect, content)
    const hpAfter = Math.max(0, target.hp - amount)
    return {
      state: withUpdatedCombatant(state, recipientId, { ...target, hp: hpAfter }),
      events: [
        {
          event: 'damage_applied',
          actionId,
          sourceCombatantId: actorId,
          targetCombatantId: recipientId,
          amount: target.hp - hpAfter,
          hpBefore: target.hp,
          hpAfter,
        },
      ],
    }
  }

  if (effect.type === 'healing') {
    const target = getCombatant(state.tactical.battle, recipientId)
    const hpAfter = addClampedSafeInteger(target.hp, effect.amount, 0, target.maxHp)
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

  if (effect.type === 'resource-change') {
    const target = getCombatant(state.tactical.battle, recipientId)
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

  const existingStatus = getStatus(state, recipientId, effect.statusId)
  const nextState = applyStatusState(
    state,
    actorId,
    recipientId,
    effect.statusId,
    effect.stacks,
    content,
  )
  const status = getStatus(nextState, recipientId, effect.statusId)
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
        refreshed: existingStatus !== null,
        stacked: existingStatus !== null && status.stacks > existingStatus.stacks,
      },
    ],
  }
}

function resolveDamageAmount(
  state: CombatEncounterState,
  actorId: string,
  recipientId: string,
  effect: Extract<CombatEffectDefinition, { type: 'damage' }>,
  content: CombatContentCatalog,
): number {
  let amount = effect.amount

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
    for (let stack = 0; stack < status.stacks; stack += 1) {
      amount = scaleByBasisPoints(amount, definition.damageTakenMultiplierBasisPoints)
    }
  }

  return amount
}

function applyStatusState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  recipientId: string,
  statusId: string,
  stacks: number,
  content: CombatContentCatalog,
): CombatEncounterState {
  assertPositiveSafeInteger(stacks, 'status stacks')
  const definition = getStatusDefinitionById(content, statusId)
  const row = getStatusRow(state, recipientId)
  const existing = row.statuses.find((status) => status.statusId === statusId)
  const nextStacks = existing
    ? addClampedSafeInteger(existing.stacks, stacks, 1, definition.maximumStacks)
    : Math.min(definition.maximumStacks, stacks)
  const nextStatus: CombatStatusInstance = existing
    ? {
        ...existing,
        stacks: nextStacks,
        remainingOwnerTurnStarts: definition.durationOwnerTurnStarts,
        sourceCombatantId,
      }
    : {
        statusId: definition.id,
        statusVersion: definition.version,
        stacks: nextStacks,
        remainingOwnerTurnStarts: definition.durationOwnerTurnStarts,
        sourceCombatantId,
      }

  const statusState = state.statusState.map((candidate) =>
    candidate.combatantId === recipientId
      ? {
          ...candidate,
          statuses: [
            ...candidate.statuses.filter((status) => status.statusId !== statusId),
            nextStatus,
          ].sort((left, right) => compareStableString(left.statusId, right.statusId)),
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
    getStatusDefinition(content, status.statusId, status.statusVersion)
    const remaining = status.remainingOwnerTurnStarts - 1
    if (remaining <= 0) {
      events.push({ event: 'status_expired', combatantId, statusId: status.statusId })
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
  const nextState = { ...state, tactical }
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
): CombatStatusInstance | null {
  return (
    getStatusRow(state, combatantId).statuses.find((status) => status.statusId === statusId) ?? null
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
  tactical: TacticalBattleState,
  origin: GridPosition,
  target: GridPosition,
): boolean {
  const points = bresenhamLine(origin, target)
  for (let index = 1; index < points.length - 1; index += 1) {
    const tile = getTile(tactical, points[index])
    const terrain = tactical.terrains.find((candidate) => candidate.id === tile.terrainId)
    if (!terrain) throw new Error(`Unknown terrain ${tile.terrainId}.`)
    if (terrain.traversalCost === null) return false
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
  content: CombatContentCatalog,
): void {
  collectRequiredIdentity(action.id, 'action id')
  assertPositiveSafeInteger(action.version, 'action version')
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

  const tagSet = new Set<string>()
  for (const tag of action.tags) {
    collectRequiredIdentity(tag, 'action tag')
    if (tagSet.has(tag)) throw new Error(`Duplicate action tag ${tag}.`)
    tagSet.add(tag)
  }

  for (const requirement of action.requirements) {
    assertKnownString(
      requirement.kind,
      ['actor-status-present', 'actor-status-absent', 'target-status-present', 'actor-hp-at-most'],
      'requirement kind',
    )
    if ('statusId' in requirement)
      collectRequiredIdentity(requirement.statusId, 'requirement status ID')
    if (requirement.kind === 'actor-hp-at-most') {
      assertBasisPoints(requirement.basisPoints, 'actor HP threshold')
    }
  }

  for (const effect of action.effects) {
    assertKnownString(
      effect.type,
      ['damage', 'healing', 'resource-change', 'apply-status'],
      'effect type',
    )
    assertKnownString(
      effect.recipient,
      ['actor', 'primary-unit', 'affected-units'],
      'effect recipient',
    )
    if (effect.type === 'damage' || effect.type === 'healing') {
      assertNonNegativeSafeInteger(effect.amount, `${effect.type} amount`)
    }
    if (effect.type === 'damage' && effect.facingModifiersBasisPoints) {
      assertBasisPoints(effect.facingModifiersBasisPoints.front, 'front damage modifier', 20_000)
      assertBasisPoints(effect.facingModifiersBasisPoints.side, 'side damage modifier', 20_000)
      assertBasisPoints(effect.facingModifiersBasisPoints.rear, 'rear damage modifier', 20_000)
    }
    if (effect.type === 'resource-change') {
      assertKnownString(effect.resource, ['mp'], 'effect resource')
      if (!Number.isSafeInteger(effect.delta)) {
        throw new RangeError('Resource delta must be a safe integer.')
      }
    }
    if (effect.type === 'apply-status') {
      collectRequiredIdentity(effect.statusId, 'effect status ID')
      assertPositiveSafeInteger(effect.stacks, 'effect status stacks')
      getStatusDefinitionById(content, effect.statusId)
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
    collectRequiredIdentity(status.id, 'status id')
    assertPositiveSafeInteger(status.version, 'status version')
    assertPositiveSafeInteger(status.maximumStacks, 'status maximum stacks')
    assertPositiveSafeInteger(status.durationOwnerTurnStarts, 'status duration')
    assertBasisPoints(status.damageTakenMultiplierBasisPoints, 'damage taken multiplier', 25_000)
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
